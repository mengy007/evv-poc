// src/app/components/DeviceBootstrap.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ensureDeviceId } from "@/app/lib/utils";
import LeafletMapClient from "@/app/components/LeafletMapClient";

dayjs.extend(utc);
dayjs.extend(timezone);

/* ------------ Types shared with API rows ------------ */
type ID = number;

interface UserRow {
  id: ID;
  name: string | null;
  hash: string | null;
}
interface PatientRow {
  id: ID;
  name: string | null;
  hash: string | null;
}
interface SessionRow {
  id: ID;
  userId: ID | null;
  patientId: ID | null;
  location: unknown; // stored as JSON: [lat, lon]
  startedAt: string | null; // UTC in DB
  endedAt: string | null; // UTC in DB (nullable)
  createdAt?: string | null;
  userName?: string | null;
  patientName?: string | null;
}

interface ApiOk {
  ok: true;
  [k: string]: unknown;
}
interface UserResp extends ApiOk {
  user: UserRow | null;
}
interface PatientResp extends ApiOk {
  patient: PatientRow | null;
}
interface SessionResp extends ApiOk {
  session: SessionRow | null;
}
interface SessionsResp extends ApiOk {
  sessions: SessionRow[];
}

/* ------------ Helpers ------------ */

function parseLatLon(loc: unknown): [number, number] | null {
  try {
    // On the client, Buffer isn't present; keep this simple and safe.
    const text = typeof loc === "string" ? loc : JSON.stringify(loc ?? "");
    const arr = JSON.parse(text);
    if (Array.isArray(arr) && arr.length === 2) {
      const [lat, lon] = arr;
      const nlat = Number(lat);
      const nlon = Number(lon);
      if (
        Number.isFinite(nlat) &&
        Number.isFinite(nlon) &&
        nlat >= -90 &&
        nlat <= 90 &&
        nlon >= -180 &&
        nlon <= 180
      ) {
        return [nlat, nlon];
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

const formatLocal = (utcTime?: string) =>
  utcTime
    ? dayjs.utc(utcTime).tz(dayjs.tz.guess()).format("YYYY-MM-DD HH:mm:ss z")
    : "—";

/* ------------ Component ------------ */

export default function DeviceBootstrap({
  agentId,
}: {
  agentId: string | null;
}) {
  const [status, setStatus] = useState<string>("Detecting device ID…");
  const [deviceId, setDeviceId] = useState<string>("");
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [recent, setRecent] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string>("");
  const [elapsed, setElapsed] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<null | "start" | "end">(
    null
  );
  const [isBusy, setIsBusy] = useState(false);
  const [selected, setSelected] = useState<SessionRow | null>(null); // clicked row -> modal

  // Close modals with Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selected) setSelected(null);
        else setConfirmAction(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Bootstrap device id, register, and fetch initial data
  useEffect(() => {
    (async () => {
      try {
        setError("");
        const { id, method } = await ensureDeviceId();
        setDeviceId(id);
        setStatus(
          method === "webauthn"
            ? "Using device-bound ID (WebAuthn)"
            : "Using local ID (browser profile)"
        );

        // Register/upsert and mirror cookie
        const regRes = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, deviceId: id }),
        });
        const regJson = (await regRes.json()) as Record<string, unknown>;
        if (!regRes.ok)
          throw new Error(
            (regJson as { error?: string })?.error || "register failed"
          );

        // Patient lookup by device hash
        const chk = await fetch(`/api/patient?hash=${encodeURIComponent(id)}`);
        const chkJson = (await chk.json()) as PatientResp;
        if (!chk.ok)
          throw new Error(
            (chkJson as unknown as { error?: string })?.error || "lookup failed"
          );
        const patientRec =
          chkJson.patient ||
          (regJson as { patient?: PatientRow })?.patient ||
          null;
        setPatient(patientRec);

        // User lookup by agent hash
        let userRec: UserRow | null = null;
        if (agentId) {
          const ures = await fetch(
            `/api/user?hash=${encodeURIComponent(agentId)}`
          );
          const ujson = (await ures.json()) as UserResp;
          if (ures.ok) userRec = ujson.user ?? null;
          setUser(userRec);
        }

        // Active session?
        if (userRec?.id && patientRec?.id) {
          const sres = await fetch(
            `/api/session?userId=${userRec.id}&patientId=${patientRec.id}`
          );
          const sjson = (await sres.json()) as SessionResp;
          if (sres.ok) setSession(sjson.session ?? null);
        }

        // All sessions (filtered if IDs known)
        const rurl = `/api/sessions?${new URLSearchParams({
          ...(userRec?.id ? { userId: String(userRec.id) } : {}),
          ...(patientRec?.id ? { patientId: String(patientRec.id) } : {}),
          limit: "all",
        }).toString()}`;
        const rres = await fetch(rurl);
        const rjson = (await rres.json()) as SessionsResp;
        if (rres.ok)
          setRecent(Array.isArray(rjson.sessions) ? rjson.sessions : []);

        setStatus("Ready");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("Error");
      }
    })();
  }, [agentId]);

  // Running timer for open session
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (session?.startedAt) {
      interval = setInterval(() => {
        const start = new Date(session.startedAt as string).getTime();
        const diff = Math.floor((Date.now() - start) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setElapsed(
          `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
            .toString()
            .padStart(2, "0")}`
        );
      }, 1000);
    } else {
      setElapsed("");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session]);

  const selectedLatLon = useMemo(
    () => (selected ? parseLatLon(selected.location) : null),
    [selected]
  );

  async function doStartSession() {
    try {
      if (!user || !patient) return;
      setIsBusy(true);
      const pos = await new Promise<{ lat: number; lon: number }>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }
      );
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          patientId: patient.id,
          location: [pos.lat, pos.lon],
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        session?: SessionRow;
      };
      if (!res.ok) throw new Error(json?.error || "start failed");
      if (json.session) setSession(json.session);

      // refresh list
      const rres = await fetch(
        `/api/sessions?userId=${user.id}&patientId=${patient.id}&limit=all`
      );
      const rjson = (await rres.json()) as SessionsResp;
      if (rres.ok)
        setRecent(Array.isArray(rjson.sessions) ? rjson.sessions : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsBusy(false);
      setConfirmAction(null);
    }
  }

  async function doEndSession() {
    try {
      if (!session) return;
      setIsBusy(true);
      const res = await fetch(`/api/session?id=${session.id}`, {
        method: "PUT",
      });
      const json = (await res.json()) as {
        error?: string;
        session?: SessionRow | null;
      };
      if (!res.ok) throw new Error(json?.error || "end failed");
      setSession(null);

      // refresh list
      const rres = await fetch(
        `/api/sessions?userId=${user?.id}&patientId=${patient?.id}&limit=all`
      );
      const rjson = (await rres.json()) as SessionsResp;
      if (rres.ok)
        setRecent(Array.isArray(rjson.sessions) ? rjson.sessions : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsBusy(false);
      setConfirmAction(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl mb-4">
      <div className="rounded-xl bg-white shadow p-4 ring-1 ring-slate-200">
        <div className="text-sm">{status}</div>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
        <div className="mt-1 text-xs text-slate-600 break-all">
          deviceId: <code className="font-mono">{deviceId || "—"}</code>
        </div>

        {/* Matched User & Patient */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              User
            </div>
            {user ? (
              <>
                <div className="text-sm font-semibold">
                  {user.name ?? "(unnamed)"}
                </div>
                <div className="text-xs text-slate-600">
                  hash: <code className="font-mono">{agentId}</code>
                </div>
                <div className="text-xs text-slate-500">id: #{user.id}</div>
              </>
            ) : (
              <div className="text-xs text-slate-500">
                No user found for this agentId.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Patient
            </div>
            {patient ? (
              <>
                <div className="text-sm font-semibold">
                  {patient.name ?? "(unnamed)"}
                </div>
                <div className="text-xs text-slate-600">
                  hash:{" "}
                  <code className="font-mono break-all">{patient.hash}</code>
                </div>
                <div className="text-xs text-slate-500">id: #{patient.id}</div>
              </>
            ) : (
              <div className="text-xs text-slate-500">
                No patient found for this device.
              </div>
            )}
          </div>
        </div>

        {/* Start/End session controls */}
        {patient && user && (
          <div className="mt-3 space-y-3">
            {session ? (
              <>
                <div className="text-center text-lg font-semibold text-green-700">
                  Session running: {elapsed}
                </div>
                <button
                  onClick={() => setConfirmAction("end")}
                  disabled={isBusy || !!confirmAction}
                  className={`px-4 py-2 rounded-lg w-full text-lg font-semibold text-white ${
                    isBusy || confirmAction
                      ? "bg-red-400"
                      : "bg-red-600 hover:bg-red-700 active:bg-red-800"
                  }`}
                >
                  End Session
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmAction("start")}
                disabled={isBusy || !!confirmAction}
                className={`px-4 py-2 rounded-lg w-full text-lg font-semibold text-white ${
                  isBusy || confirmAction
                    ? "bg-green-400"
                    : "bg-green-600 hover:bg-green-700 active:bg-green-800"
                }`}
              >
                Start Session
              </button>
            )}
          </div>
        )}

        {/* All Sessions (clickable rows) */}
        {recent && (
          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">All Sessions</div>
            {recent.length ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Patient</th>
                      <th className="px-3 py-2 text-left">Started</th>
                      <th className="px-3 py-2 text-left">Ended</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recent.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className="cursor-pointer hover:bg-slate-100 active:bg-slate-200"
                      >
                        <td className="px-3 py-2 font-medium">#{r.id}</td>
                        <td className="px-3 py-2">
                          {r.userName ?? r.userId ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {r.patientName ?? r.patientId ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {formatLocal(r.startedAt ?? undefined)}
                        </td>
                        <td className="px-3 py-2">
                          {r.endedAt ? formatLocal(r.endedAt) : "(open)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-slate-500">No sessions yet.</div>
            )}
          </div>
        )}

        {/* Start/End confirmation modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fadeIn">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => (!isBusy ? setConfirmAction(null) : null)}
            />
            <div className="relative z-10 w-full sm:w-[28rem] max-w-full rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div
                    className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                      confirmAction === "start" ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    <span
                      className={`text-lg ${
                        confirmAction === "start"
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {confirmAction === "start" ? "▶" : "■"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base sm:text-lg font-semibold">
                      {confirmAction === "start"
                        ? "Start Session"
                        : "End Session"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {confirmAction === "start"
                        ? "This will begin a session using your current GPS location and time."
                        : "This will stop the current session and record the end time."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 sm:mt-6 flex gap-3">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 px-4 py-3 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  {confirmAction === "start" ? (
                    <button
                      type="button"
                      onClick={doStartSession}
                      disabled={isBusy}
                      className="flex-1 px-4 py-3 rounded-xl text-white bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
                    >
                      {isBusy ? "Starting…" : "Yes, Start"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={doEndSession}
                      disabled={isBusy}
                      className="flex-1 px-4 py-3 rounded-xl text-white bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50"
                    >
                      {isBusy ? "Ending…" : "Yes, End"}
                    </button>
                  )}
                </div>

                <div className="mt-4 flex justify-center sm:hidden">
                  <div className="h-1.5 w-10 rounded-full bg-slate-300" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session details + map modal */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fadeIn">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelected(null)}
            />
            <div className="relative z-10 w-full sm:w-[32rem] max-w-full rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
              <div className="p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold">
                    Session #{selected.id}
                  </h2>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-slate-500 hover:text-slate-700 text-sm"
                  >
                    Close ✕
                  </button>
                </div>

                <div className="text-xs text-slate-600">
                  <div>
                    User:{" "}
                    <span className="font-medium">
                      {selected.userName ?? selected.userId ?? "—"}
                    </span>
                  </div>
                  <div>
                    Patient:{" "}
                    <span className="font-medium">
                      {selected.patientName ?? selected.patientId ?? "—"}
                    </span>
                  </div>
                  <div>
                    Started:{" "}
                    <span className="font-medium">
                      {formatLocal(selected.startedAt ?? undefined)}
                    </span>
                  </div>
                  <div>
                    Ended:{" "}
                    <span className="font-medium">
                      {selected.endedAt
                        ? formatLocal(selected.endedAt)
                        : "(open)"}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-200">
                  {selectedLatLon ? (
                    <LeafletMapClient
                      center={selectedLatLon}
                      zoom={15}
                      showMarker
                      popupTitle={`Session #${selected.id}`}
                      popupSubtitle={formatLocal(
                        selected.startedAt ?? undefined
                      )}
                    />
                  ) : (
                    <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                      No location stored for this session.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
