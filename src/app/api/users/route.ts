// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

type ID = number;

export interface UserRow {
  id: ID;
  name: string | null;
  hash: string | null;
}

type UsersOk = { ok: true; users: UserRow[] };
type CreateOk = { ok: true; user: UserRow };
type Err = { error: string };

// parse limit=all | N (default 10, cap 1000)
function parseLimit(limitParam: string | null): number | null {
  if (limitParam === "all") return null;
  if (limitParam == null) return 10;
  const n = Number(limitParam);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(n, 1000);
}

/**
 * GET /api/users?limit=all|N
 */
export async function GET(req: NextRequest): Promise<NextResponse<UsersOk | Err>> {
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));

  const limitSql = limit === null ? "" : "LIMIT ?";
  const params: Array<string | number> = [];
  if (limit !== null) params.push(limit);

  const [rows] = await pool().query<RowDataPacket[]>(
    `SELECT id, name, hash
       FROM \`User\`
      ORDER BY id DESC
      ${limitSql}`,
    params
  );

  const users: UserRow[] = rows.map((r) => ({
    id: Number(r.id),
    name: (r.name as string | null) ?? null,
    hash: (r.hash as string | null) ?? null,
  }));

  return NextResponse.json({ ok: true, users });
}

/**
 * POST /api/users
 * Body: { name?: string | null, hash?: string | null }
 */
export async function POST(req: NextRequest): Promise<NextResponse<CreateOk | Err>> {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string | null;
    hash?: string | null;
  };

  const name = (typeof body.name === "string" ? body.name.trim() : null) || null;
  const hash =
    (typeof body.hash === "string" ? body.hash.trim() : null) ||
    randomBytes(16).toString("hex");

  const [ins] = await pool().execute<ResultSetHeader>(
    "INSERT INTO `User` (`name`, `hash`) VALUES (?, ?)",
    [name, hash]
  );
  const insertedId = Number(ins.insertId);

  const [rows] = await pool().query<RowDataPacket[]>(
    "SELECT id, name, hash FROM `User` WHERE id = ? LIMIT 1",
    [insertedId]
  );

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Insert succeeded but row not found." }, { status: 500 });
  }

  const user: UserRow = {
    id: insertedId,
    name: (row.name as string | null) ?? null,
    hash: (row.hash as string | null) ?? null,
  };

  return NextResponse.json({ ok: true, user });
}
