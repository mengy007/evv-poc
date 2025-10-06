// app/api/users/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { parsePagination, ok, badRequest, serverError, noStoreJson } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateUser = z.object({
  hash: z.string().max(128).nullable().optional(),
  name: z.string().max(128).nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { limit, offset } = parsePagination(req.url);
    const [rows] = await pool.query(
      'SELECT id, hash, name FROM User ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return ok(rows);
  } catch (e) {
    return serverError(e, 'Failed to list users');
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = CreateUser.safeParse(await req.json());
    if (!parsed.success) return badRequest('Validation failed', { issues: parsed.error.issues });

    const { hash = null, name = null } = parsed.data;
    const [result] = await pool.execute(
      'INSERT INTO User (hash, name) VALUES (?, ?)',
      [hash, name]
    );
    // @ts-ignore
    const insertId: number = result.insertId;

    const [rows] = await pool.query('SELECT id, hash, name FROM User WHERE id = ?', [insertId]);
    return noStoreJson((rows as any[])[0], { status: 201 });
  } catch (e) {
    return serverError(e, 'Failed to create user');
  }
}
