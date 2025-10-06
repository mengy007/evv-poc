// src/app/api/patient/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

type PatientRow = { id: number; name: string | null; hash: string | null };
type OkPayload = { ok: true; patient: PatientRow | null };
type ErrPayload = { error: string };

export async function GET(req: NextRequest): Promise<NextResponse<OkPayload | ErrPayload>> {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get("hash");

  if (!hash) {
    return NextResponse.json({ error: "Missing required query param: hash" }, { status: 400 });
  }

  const [rows] = await pool().query<RowDataPacket[]>(
    "SELECT `id`,`name`,`hash` FROM `Patient` WHERE `hash` = ? LIMIT 1",
    [hash]
  );

  const patient = (rows[0] as PatientRow | undefined) ?? null;
  return NextResponse.json({ ok: true, patient });
}
