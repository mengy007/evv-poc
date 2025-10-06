// src/app/lib/utils.ts

/**
 * Utilities used on the client for deriving a stable device identifier.
 * Attempts WebAuthn (device-bound credential); falls back to a local ID.
 */

export type DeviceIdMethod = "webauthn" | "local";

export interface DeviceIdResult {
  id: string;
  method: DeviceIdMethod;
}

/** Storage key for fallback local device id */
const LOCAL_DEVICE_KEY = "device-id";

/**
 * Generate (or load) a local device identifier tied to the browser profile.
 * Uses crypto.randomUUID() where available; otherwise falls back to a short hash.
 */
function getOrCreateLocalDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(LOCAL_DEVICE_KEY);
  if (existing && existing.trim()) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto.randomUUID() as string)
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

  window.localStorage.setItem(LOCAL_DEVICE_KEY, id);
  return id;
}

/**
 * Try to create a device-bound WebAuthn credential and derive a stable id from it.
 * Note: This is a best-effort approach and may require user gesture/permissions.
 * If anything fails, we return null to allow fallback to a local id.
 */
async function tryWebAuthnDeviceId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("PublicKeyCredential" in window)) return null;

  try {
    // Minimal, RP-agnostic challenge (not for authentication; just to bind to device)
    const challenge = new Uint8Array(16);
    if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
      crypto.getRandomValues(challenge);
    }

    const pubKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "Device ID Bootstrap" },
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

    // Derive a stable identifier from the credential ID (base64url)
    const rawId = cred.rawId; // ArrayBuffer
    const b64url = bufferToBase64Url(rawId);
    return `webauthn:${b64url}`;
  } catch {
    return null;
  }
}

/** Convert ArrayBuffer -> base64url (RFC4648 §5, no padding) */
function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa !== "undefined" ? btoa(str) : Buffer.from(str, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Public entry: returns a device identifier and the method used.
 * - First tries WebAuthn for a device-bound credential
 * - Falls back to a local (profile-bound) ID stored in localStorage
 */
export async function ensureDeviceId(): Promise<DeviceIdResult> {
  // Only attempt WebAuthn client-side
  if (typeof window !== "undefined") {
    const webAuthn = await tryWebAuthnDeviceId();
    if (webAuthn) return { id: webAuthn, method: "webauthn" };
  }
  const local = getOrCreateLocalDeviceId();
  return { id: local, method: "local" };
}
