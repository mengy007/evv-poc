// src/app/api/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export const runtime = "nodejs";

type ID = number;

export interface SessionRow {
  id: ID;
  userId: ID | null;
  patientId: ID | null;
  location: unknown;          // stored as JSON in MySQL
  startedAt: string | null;   // UTC timestamps recommended
  endedAt: string | null;
  createdAt?: string | null;
}

type Ok<T> = { ok: true } & T;
type Err = { error: string };

// GET /api/session?userId=...&patientId=...
// Returns the latest OPEN session (endedAt IS NULL) matching user+patient.
export async function GET(req: NextRequest): Promise<NextResponse<Ok<{ session: SessionRow | null }> | Err>> {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const patientId = searchParams.get("patientId");

  if (!userId || !patientId) {
    return NextResponse.json({ error: "Missing userId or patientId" }, { status: 400 });
  }

  const [rows] = await pool().query<RowDataPacket[]>(
    `SELECT s.id, s.userId, s.patientId,
            JSON_EXTRACT(s.location, '$') AS location,
            s.startedAt, s.endedAt, s.createdAt
       FROM \`Session\` s
      WHERE s.userId = ? AND s.patientId = ? AND s.endedAt IS NULL
      ORDER BY s.id DESC
      LIMIT 1`,
    [userId, patientId]
  );

  const session = (rows[0] as SessionRow | undefined) ?? null;
  return NextResponse.json({ ok: true, session });
}

// POST /api/session
// Body: { userId: number, patientId: number, location?: [lat: number, lon: number] | any }
export async function POST(req: NextRequest): Promise<NextResponse<Ok<{ session: SessionRow }> | Err>> {
  const body = (await req.json().catch(() => ({}))) as {
    userId?: number;
    patientId?: number;
    location?: unknown;
  };

  const userId = Number(body.userId);
  const patientId = Number(body.patientId);
  if (!Number.isFinite(userId) || !Number.isFinite(patientId)) {
    return NextResponse.json({ error: "Invalid or missing userId/patientId" }, { status: 400 });
  }

  // Optional: close any existing open session for same user+patient (business rule)
  // await pool().execute(
  //   "UPDATE `Session` SET endedAt = UTC_TIMESTAMP() WHERE userId = ? AND patientId = ? AND endedAt IS NULL",
  //   [userId, patientId]
  // );

  const locJson = body.location !== undefined ? JSON.stringify(body.location) : null;

  const [ins] = await pool().execute<ResultSetHeader>(
    `INSERT INTO \`Session\` (userId, patientId, location, startedAt, createdAt)
     VALUES (?, ?, CAST(? AS JSON), UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [userId, patientId, locJson]
  );

  const insertedId = Number(ins.insertId);

  const [rows] = await pool().query<RowDataPacket[]>(
    `SELECT s.id, s.userId, s.patientId,
            JSON_EXTRACT(s.location, '$') AS location,
            s.startedAt, s.endedAt, s.createdAt
       FROM \`Session\` s
      WHERE s.id = ?
      LIMIT 1`,
    [insertedId]
  );

  const session = rows[0] as SessionRow | undefined;
  if (!session) {
    return NextResponse.json({ error: "Insert succeeded but session not found." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, session });
}

// PUT /api/session?id=123
// Ends a session by id (sets endedAt to UTC now)
export async function PUT(req: NextRequest): Promise<NextResponse<Ok<{ session: SessionRow | null }> | Err>> {
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get("id");
  const id = Number(idParam);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }

  await pool().execute(
    "UPDATE `Session` SET endedAt = UTC_TIMESTAMP() WHERE id = ? AND endedAt IS NULL",
    [id]
  );

  const [rows] = await pool().query<RowDataPacket[]>(
    `SELECT s.id, s.userId, s.patientId,
            JSON_EXTRACT(s.location, '$') AS location,
            s.startedAt, s.endedAt, s.createdAt
       FROM \`Session\` s
      WHERE s.id = ?
      LIMIT 1`,
    [id]
  );

  const session = (rows[0] as SessionRow | undefined) ?? null;
  return NextResponse.json({ ok: true, session });
}
