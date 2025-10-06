// app/api/patients/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { parsePagination, ok, badRequest, serverError, noStoreJson } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // never cache

const CreatePatient = z.object({
  hash: z.string().max(128).nullable().optional(),
  name: z.string().max(128).nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { limit, offset } = parsePagination(req.url);
    const [rows] = await pool.query(
      'SELECT id, hash, name FROM Patient ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return ok(rows);
  } catch (e) {
    return serverError(e, 'Failed to list patients');
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = CreatePatient.safeParse(await req.json());
    if (!parsed.success) return badRequest('Validation failed', { issues: parsed.error.issues });

    const { hash = null, name = null } = parsed.data;

    const [result] = await pool.execute(
      'INSERT INTO Patient (hash, name) VALUES (?, ?)',
      [hash, name]
    );
    // @ts-ignore - mysql2 typings
    const insertId: number = result.insertId;

    const [rows] = await pool.query('SELECT id, hash, name FROM Patient WHERE id = ?', [insertId]);
    return noStoreJson((rows as any[])[0], { status: 201 });
  } catch (e) {
    return serverError(e, 'Failed to create patient');
  }
}
