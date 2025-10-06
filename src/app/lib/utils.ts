export function base64url(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function getOrCreateLocalId(): string {
  if (typeof localStorage === "undefined") return crypto.randomUUID();
  let id = localStorage.getItem("device_local_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("device_local_id", id); }
  
  return id;
}

async function createWebAuthnId(): Promise<string> {
  if (!("credentials" in navigator) || !("PublicKeyCredential" in window)) {
    throw new Error("WebAuthn not supported");
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Agent Device ID" },
      user: { id: userId, name: "agent", displayName: "agent" },
      pubKeyCredParams: [ { type: "public-key", alg: -7 }, { type: "public-key", alg: -257 } ],
      authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "preferred" },
      attestation: "none",
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("No credential returned");
  const raw = (cred as any).rawId as ArrayBuffer;
  const id = base64url(raw);
  localStorage.setItem("device_webauthn_id", id);
  return id;
}

/** Ensure we have a device identifier sourced from the device (WebAuthn preferred). */
export async function ensureDeviceId(): Promise<{ id: string; method: "webauthn" | "local" }> {
  try {
    const existingWA = typeof localStorage !== "undefined" ? localStorage.getItem("device_webauthn_id") : null;
    if (existingWA) return { id: existingWA, method: "webauthn" };
    const id = await createWebAuthnId();

    return { id, method: "webauthn" };
  } catch (_) {
    const id = getOrCreateLocalId();
    return { id, method: "local" };
  }
}