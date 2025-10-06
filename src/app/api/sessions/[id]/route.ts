import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userHash = searchParams.get("userHash");
    const patientHash = searchParams.get("patientHash");
    const limitParam = searchParams.get("limit");

    // Support `limit=all` to include completed sessions and avoid LIMIT
    let limitValue: number | null = 10; // default
    if (limitParam === "all") {
      limitValue = null;
    } else if (limitParam) {
      const n = Number(limitParam);
      if (Number.isFinite(n) && n > 0) limitValue = Math.min(n, 1000);
    }

    const where: string[] = [];
    const params: any[] = [];
    if (userHash) { where.push("u.hash = ?"); params.push(userHash); }
    if (patientHash) { where.push("p.hash = ?"); params.push(patientHash); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const limitSql = limitValue ? "LIMIT ?" : "";
    const limitParams = limitValue ? [limitValue] : [];

    const [rows] = await pool().query<any[]>(
      `SELECT s.id, s.userId, s.patientId,
              JSON_EXTRACT(s.location,'$') AS location,
              s.startedAt, s.endedAt, s.createdAt,
              u.name AS userName, p.name AS patientName
       FROM \`Session\` s
       JOIN \`User\` u ON u.id = s.userId
       JOIN \`Patient\` p ON p.id = s.patientId
       ${whereSql}
       ORDER BY s.id DESC
       ${limitSql}`,
      [...params, ...limitParams]
    );

    // Includes BOTH open (endedAt IS NULL) and completed sessions
    return NextResponse.json({ ok: true, sessions: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}