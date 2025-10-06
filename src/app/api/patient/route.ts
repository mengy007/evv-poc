import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hash = searchParams.get("hash");
    if (!hash) return NextResponse.json({ error: "hash required" }, { status: 400 });

    const [rows] = await pool().query<any[]>(
      "SELECT id, hash, name FROM Patient WHERE hash = ? LIMIT 1",
      [hash]
    );
    const patient = (rows as any[])[0] || null;
    return NextResponse.json({ ok: true, patient });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}