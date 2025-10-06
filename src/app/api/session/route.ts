import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const deviceId = searchParams.get("deviceId");
    if (!agentId || !deviceId) return NextResponse.json({ error: "agentId and deviceId required" }, { status: 400 });
    const [rows] = await pool().query<any[]>(
      `SELECT s.* FROM Session s
       JOIN User u ON u.id = s.userId
       JOIN Patient p ON p.id = s.patientId
       WHERE u.hash = ? AND p.hash = ? AND s.endedAt IS NULL
       LIMIT 1`,
      [agentId, deviceId]
    );
    const session = (rows as any[])[0] || null;
    return NextResponse.json({ ok: true, session });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, patientId, location } = await req.json();
    const [res] = await pool().execute(
      "INSERT INTO Session (userId, patientId, location, startedAt) VALUES (?, ?, ?, NOW())",
      [userId, patientId, JSON.stringify(location)]
    );
    const insertId = (res as any).insertId;
    return NextResponse.json({ ok: true, session: { id: insertId, userId, patientId, location, startedAt: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await pool().execute("UPDATE Session SET endedAt = NOW() WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}
