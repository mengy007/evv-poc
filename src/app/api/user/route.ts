// src/app/api/user/route.ts
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

type OkGet = { ok: true; user: UserRow | null };
type OkPost = { ok: true; user: UserRow };
type Err = { error: string };

/**
 * GET /api/user?hash=...
 * Looks up a single user by hash.
 */
export async function GET(req: NextRequest): Promise<NextResponse<OkGet | Err>> {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get("hash");

  if (!hash) {
    return NextResponse.json({ error: "Missing required query param: hash" }, { status: 400 });
  }

  const [rows] = await pool().query<RowDataPacket[]>(
    "SELECT `id`,`name`,`hash` FROM `User` WHERE `hash` = ? LIMIT 1",
    [hash]
  );

  const user = (rows[0] as UserRow | undefined) ?? null;
  return NextResponse.json({ ok: true, user });
}

/**
 * POST /api/user
 * Body: { name?: string | null, hash?: string | null }
 * Creates a user; if no hash provided, generates a random one.
 */
export async function POST(req: NextRequest): Promise<NextResponse<OkPost | Err>> {
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
    "SELECT `id`,`name`,`hash` FROM `User` WHERE `id` = ? LIMIT 1",
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
