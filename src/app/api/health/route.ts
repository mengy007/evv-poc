import { NextResponse } from 'next/server';
import { dbHealth } from '@/lib/db';

export const dynamic = 'force-dynamic'; // don't cache

export async function GET() {
  try {
    await dbHealth();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Don’t leak secrets; show which envs are present
    return NextResponse.json({
      ok: false,
      error: err?.message ?? String(err),
      env: {
        MYSQL_HOST: !!process.env.MYSQL_HOST,
        MYSQL_PORT: !!process.env.MYSQL_PORT,
        MYSQL_USER: !!process.env.MYSQL_USER,
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ? true : false,
        MYSQL_DATABASE: !!process.env.MYSQL_DATABASE,
        MYSQL_SSL: process.env.MYSQL_SSL ?? 'unset',
      },
      hint:
        'Ensure .env.local exists at project root and restart `next dev`. ' +
        'On Vercel, add env vars in Project Settings and redeploy.',
    }, { status: 500 });
  }
}
