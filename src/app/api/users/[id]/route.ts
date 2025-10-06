// app/api/users/[id]/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { pool } from '@/app/lib/db';
import { ok, badRequest, notFound, serverError } from '@/app/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UpdateUser = z.object({
  hash: z.string().max(128).nullable().optional(),
  name: z.string().max(128).nullable().optional(),
}).partial();

function idFromParams(params: { id: string }) {
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = idFromParams(params);
    if (!id) return badRequest('Invalid id');
    const [rows] = await pool.query('SELECT id, hash, name FROM User WHERE id = ?', [id]);
    const row = (rows as any[])[0];
    return row ? ok(row) : notFound();
  } catch (e) {
    return serverError(e, 'Failed to fetch user');
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = idFromParams(params);
    if (!id) return badRequest('Invalid id');

    const parsed = UpdateUser.safeParse(await req.json());
    if (!parsed.success) return badRequest('Validation failed', { issues: parsed.error.issues });

    const fields: string[] = [];
    const values: any[] = [];
    if ('hash' in parsed.data) { fields.push('hash = ?'); values.push(parsed.data.hash ?? null); }
    if ('name' in parsed.data) { fields.push('name = ?'); values.push(parsed.data.name ?? null); }
    if (fields.length === 0) return badRequest('No fields to update');

    values.push(id);
    const [result] = await pool.execute(`UPDATE User SET ${fields.join(', ')} WHERE id = ?`, values);
    // @ts-ignore
    if (result.affectedRows === 0) return notFound();

    const [rows] = await pool.query('SELECT id, hash, name FROM User WHERE id = ?', [id]);
    return ok((rows as any[])[0]);
  } catch (e) {
    return serverError(e, 'Failed to update user');
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = idFromParams(params);
    if (!id) return badRequest('Invalid id');

    const [result] = await pool.execute('DELETE FROM User WHERE id = ?', [id]);
    // @ts-ignore
    if (result.affectedRows === 0) return notFound();
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return serverError(e, 'Failed to delete user');
  }
}
