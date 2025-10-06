import { pool } from "@/app/lib/db";
import DeviceBootstrap from "@/app/components/DeviceBootstrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CntRow = { count: number };
// ... (types unchanged)

type UserRow = { id: number; name: string | null; hash: string | null };
type PatientRow = { id: number; name: string | null; hash: string | null };
type SessionRow = {
  id: number;
  userId: number | null;
  patientId: number | null;
  location: unknown;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  userName: string | null;
  patientName: string | null;
};

async function rows<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [r] = await pool().query<T[]>(sql, params);
  return (r as T[]) ?? [];
}

function qp(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return undefined;
}

function formatLocation(loc: unknown): string {
  /* unchanged */
  try {
    const text =
      typeof loc === "string"
        ? loc
        : typeof Buffer !== "undefined" && (loc as any) && Buffer.isBuffer(loc)
        ? (loc as Buffer).toString("utf8")
        : JSON.stringify(loc ?? "");
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
        return `${nlat.toFixed(5)}, ${nlon.toFixed(5)}`;
      }
    }
  } catch {}
  return "—";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const agentHash = qp(searchParams.agentId);
  // deviceHash intentionally NOT read from URL anymore

  // Header stats
  const [pc, uc, sc] = await Promise.all([
    rows<CntRow>("SELECT COUNT(*) AS count FROM `Patient`"),
    rows<CntRow>("SELECT COUNT(*) AS count FROM `User`"),
    rows<CntRow>("SELECT COUNT(*) AS count FROM `Session`"),
  ]);
  const patientCount = Number(pc[0]?.count ?? 0);
  const userCount = Number(uc[0]?.count ?? 0);
  const sessionCount = Number(sc[0]?.count ?? 0);

  // Lookup User by agent hash (from URL)
  const user = agentHash
    ? (
        await rows<UserRow>(
          "SELECT `id`,`name`,`hash` FROM `User` WHERE `hash` = ? LIMIT 1",
          [agentHash]
        )
      )[0]
    : undefined;

  // We won't resolve patient here because device ID is obtained client-side.

  // Recent lists
  const [patientsRows, usersRows] = await Promise.all([
    rows<PatientRow>(
      "SELECT `id`,`name`,`hash` FROM `Patient` ORDER BY `id` DESC LIMIT 10"
    ),
    rows<UserRow>(
      "SELECT `id`,`name`,`hash` FROM `User` ORDER BY `id` DESC LIMIT 10"
    ),
  ]);

  return (
    <div className="min-h-dvh p-6">
      <DeviceBootstrap agentId={agentHash ?? null} />
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Card title="Recent Sessions">
          <p className="text-sm text-slate-600 mb-2">
            (Add session creation later to link user ↔ patient.)
          </p>
          {/* Table omitted here for brevity; keep your previous sessions table if needed */}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  /* unchanged */
  return (
    <div className="rounded-xl bg-white shadow p-4 ring-1 ring-slate-200">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white shadow p-5 ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ hint }: { hint: string }) {
  return <div className="py-6 text-slate-500 text-sm">{hint}</div>;
}
