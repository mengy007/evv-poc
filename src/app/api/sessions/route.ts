// src/app/api/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

type ID = number;

export interface SessionRow {
  id: ID;
  userId: ID | null;
  patientId: ID | null;
  location: unknown;          // stored as JSON in MySQL
  startedAt: string | null;   // UTC
  endedAt: string | null;     // UTC or null if open
  createdAt?: string | null;
  userName?: string | null;   // joined value
  patientName?: string | null;// joined value
}

type Ok = { ok: true; sessions: SessionRow[] };
type Err = { error: string };

// parse limit=all | N (default 10, max 1000)
function parseLimit(param: string | null): number | null {
  if (param === "all") return null;
  if (param == null) return 10;
  const n = Number(param);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(n, 1000);
}

export async function GET(req: NextRequest): Promise<NextResponse<Ok | Err>> {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const patientId = searchParams.get("patientId");
  const limitParam = searchParams.get("limit");
  const limit = parseLimit(limitParam);

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (userId) {
    where.push("s.userId = ?");
    params.push(Number(userId));
  }
  if (patientId) {
    where.push("s.patientId = ?");
    params.push(Number(patientId));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limitSql = limit === null ? "" : "LIMIT ?";
  if (limit !== null) params.push(limit);

  const [rows] = await pool().query<RowDataPacket[]>(
    `SELECT
        s.id,
        s.userId,
        s.patientId,
        JSON_EXTRACT(s.location, '$') AS location,
        s.startedAt,
        s.endedAt,
        s.createdAt,
        u.name AS userName,
        p.name AS patientName
     FROM \`Session\` s
     LEFT JOIN \`User\` u    ON u.id = s.userId
     LEFT JOIN \`Patient\` p ON p.id = s.patientId
     ${whereSql}
     ORDER BY s.id DESC
     ${limitSql}`,
    params
  );

  // Project to our type safely
  const sessions: SessionRow[] = rows.map((r) => ({
    id: Number(r.id),
    userId: r.userId == null ? null : Number(r.userId),
    patientId: r.patientId == null ? null : Number(r.patientId),
    location: r.location as unknown,
    startedAt: (r.startedAt as string | null) ?? null,
    endedAt: (r.endedAt as string | null) ?? null,
    createdAt: (r.createdAt as string | null) ?? null,
    userName: (r.userName as string | null) ?? null,
    patientName: (r.patientName as string | null) ?? null,
  }));

  return NextResponse.json({ ok: true, sessions });
}
