// src/app/lib/utils.ts

export type DeviceIdMethod = "cookie" | "local" | "webauthn";
export interface DeviceIdResult {
  id: string;
  method: DeviceIdMethod;
}

const LOCAL_DEVICE_KEY = "device-id";
const COOKIE_NAME = "device_id";

/* ---------------- helpers ---------------- */

function escapeRegex(s: string): string {
  // Escape characters that have special meaning in a regex
  // Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ---------------- cookie helpers (client-side) ---------------- */

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const pattern = new RegExp(`(?:^|; )${escapeRegex(name)}=([^;]*)`);
  const m = document.cookie.match(pattern);
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  const isHttps =
    typeof location !== "undefined" && location.protocol === "https:";
  // Avoid 'Secure' on http (e.g., localhost) so it still sets during local dev
  const secure = isHttps ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

/* ---------------- localStorage helpers ---------------- */

function getLocalId(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LOCAL_DEVICE_KEY);
  return v && v.trim() ? v : null;
}

function setLocalId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_DEVICE_KEY, id);
  } catch {
    /* ignore quota / private mode errors */
  }
}

/* ---------------- WebAuthn bootstrap (first-time only) ---------------- */

async function createWebAuthnId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("PublicKeyCredential" in window)) return null;

  try {
    const challenge = new Uint8Array(16);
    if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
      crypto.getRandomValues(challenge);
    }

    const pubKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "Device ID" }, // RP ID defaults to current site
      user: {
        id: new TextEncoder().encode("device-seed"),
        name: "device@example.invalid",
        displayName: "Device",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "preferred",
        residentKey: "preferred",
        requireResidentKey: false,
      },
      timeout: 30_000,
    };

    const cred = (await navigator.credentials.create({
      publicKey: pubKey,
    })) as PublicKeyCredential | null;

    if (!cred) return null;

    // Derive a device id from the credential ID (base64url)
    const rawId = cred.rawId;
    const id = bufferToBase64Url(rawId);
    return `webauthn:${id}`;
  } catch {
    return null;
  }
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  const b64 =
    typeof btoa !== "undefined"
      ? btoa(str)
      : Buffer.from(str, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/* ---------------- Public API ---------------- */

/**
 * Returns a stable device id and the method used.
 * Precedence on subsequent loads:
 *  1) cookie device_id
 *  2) localStorage device-id
 *  3) create once (WebAuthn) -> persist to cookie + localStorage
 *  4) random fallback        -> persist to cookie + localStorage
 */
export async function ensureDeviceId(): Promise<DeviceIdResult> {
  // 1) cookie
  const cookieId = getCookie(COOKIE_NAME);
  if (cookieId) return { id: cookieId, method: "cookie" };

  // 2) localStorage
  const localId = getLocalId();
  if (localId) {
    setCookie(COOKIE_NAME, localId); // mirror to cookie for server visibility
    return { id: localId, method: "local" };
  }

  // 3) first-time bootstrap via WebAuthn (best-effort)
  const waId = await createWebAuthnId();
  if (waId) {
    setLocalId(waId);
    setCookie(COOKIE_NAME, waId);
    return { id: waId, method: "webauthn" };
  }

  // 4) fallback random (UUID if available)
  const fallback =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto.randomUUID() as string)
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

  setLocalId(fallback);
  setCookie(COOKIE_NAME, fallback);
  return { id: fallback, method: "local" };
}
