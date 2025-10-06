// src/app/api/health/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type HealthPayload = { ok: true; uptime: number };

export async function GET(_req: NextRequest): Promise<NextResponse<HealthPayload>> {
  return NextResponse.json({ ok: true, uptime: process.uptime() });
}
