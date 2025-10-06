// middleware.ts (or src/middleware.ts)
import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = 'device_id';

// Edge-safe random hex ID (no Node 'crypto')
function randomHexId(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr); // Web Crypto (Edge-supported)
  let s = '';
  for (const b of arr) s += b.toString(16).padStart(2, '0');
  return s; // 64 hex chars
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // If already set, do nothing
  const existing = req.cookies.get(COOKIE_NAME)?.value;
  if (existing) return res;

  // Generate a stable per-device cookie (persists until cleared)
  const id = randomHexId(32);
  const isProd = process.env.NODE_ENV === 'production';

  res.cookies.set({
    name: COOKIE_NAME,
    value: id,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,    // avoid Secure on http://localhost
    path: '/',
    maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
  });

  return res;
}

// Optional: run on everything (default is fine, but you can be explicit)
// export const config = { matcher: '/:path*' };
