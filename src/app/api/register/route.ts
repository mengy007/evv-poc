// app/api/register/route.ts
import { cookies } from "next/headers";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Retrieve cookies (cookies() is now async in some Next.js setups)
    const cookieStore = await cookies();
    const cookieDeviceId = cookieStore.get("device_id")?.value ?? null;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const agentId =
      typeof body.agentId === "string" && body.agentId.trim()
        ? body.agentId.trim()
        : null;

    const deviceId =
      typeof body.deviceId === "string" && body.deviceId.trim()
        ? body.deviceId.trim()
        : cookieDeviceId;

    if (!deviceId) {
      return NextResponse.json({ error: "device id not provided" }, { status: 400 });
    }

    // Mock registration or persistence logic
    const result = {
      ok: true,
      agentId,
      deviceId,
      message: "Device successfully registered or verified",
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
