// src/app/api/patients/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

type ID = number;
export interface PatientRow {
  id: ID;
  name: string | null;
  hash: string | null;
}

type PatientsOk = { ok: true; patients: PatientRow[] };
type CreateOk = { ok: true; patient: PatientRow };
type Err = { error: string };

// Utility: parse `limit` from query string, allow `limit=all`
function parseLimit(limitParam: string | null): number | null {
  if (limitParam === null) return 10; // default
  if (limitParam === "all") return null;
  const n = Number(limitParam);
  if (!Number.isFinite(n) || n <= 0) return 10;
  // put a generous upper bound to avoid accidental full table scans
  return Math.min(n, 1000);
}

// GET /api/patients?limit=all|N
export async function GET(req: NextRequest): Promise<NextResponse<PatientsOk | Err>> {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = parseLimit(limitParam);

  const limitSql = limit === null ? "" : "LIMIT ?";
  const params: unknown[] = [];
  if (limit !== null) params.push(limit);

  const [rows] = await pool().query<RowDataPacket[]>(
    `SELECT id, name, hash
       FROM \`Patient\`
       ORDER BY id DESC
       ${limitSql}`,
    params
  );

  // Safely project to our PatientRow shape
  const patients: PatientRow[] = rows.map((r) => ({
    id: Number(r.id),
    name: (r.name as string | null) ?? null,
    hash: (r.hash as string | null) ?? null,
  }));

  return NextResponse.json({ ok: true, patients });
}

// POST /api/patients
// Body: { name?: string | null, hash?: string | null }
export async function POST(req: NextRequest): Promise<NextResponse<CreateOk | Err>> {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string | null;
    hash?: string | null;
  };

  // Allow either/both fields; generate a hash if not provided.
  const name = (typeof body.name === "string" ? body.name.trim() : null) || null;
  const hash =
    (typeof body.hash === "string" ? body.hash.trim() : null) ||
    // generate a URL-safe, short-ish default hash:
    randomBytes(16).toString("hex");

  // Insert
  const [res] = await pool().execute<ResultSetHeader>(
    "INSERT INTO `Patient` (`name`, `hash`) VALUES (?, ?)",
    [name, hash]
  );

  const insertedId = Number(res.insertId);

  // Return the inserted row
  const [rows] = await pool().query<RowDataPacket[]>(
    "SELECT id, name, hash FROM `Patient` WHERE id = ? LIMIT 1",
    [insertedId]
  );

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Insert succeeded but row not found." }, { status: 500 });
  }

  const patient: PatientRow = {
    id: insertedId,
    name: (row.name as string | null) ?? null,
    hash: (row.hash as string | null) ?? null,
  };

  return NextResponse.json({ ok: true, patient });
}
