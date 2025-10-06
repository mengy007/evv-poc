// src/lib/api.ts
import { NextResponse } from 'next/server';

export function noStoreJson(body: any, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

// Parse ?limit & ?offset with sane bounds
export function parsePagination(url: string) {
  const u = new URL(url);
  const limit = Math.min(Math.max(Number(u.searchParams.get('limit') ?? 50), 1), 200);
  const offset = Math.max(Number(u.searchParams.get('offset') ?? 0), 0);
  return { limit, offset };
}

export function ok<T>(data: T) {
  return noStoreJson(data);
}

export function badRequest(message: string, extra?: any) {
  return noStoreJson({ error: message, ...extra }, { status: 400 });
}

export function notFound(message = 'Not found') {
  return noStoreJson({ error: message }, { status: 404 });
}

export function serverError(e: any, fallback = 'Server error') {
  const msg = e?.message ?? String(e);
  return noStoreJson({ error: fallback, detail: msg }, { status: 500 });
}
