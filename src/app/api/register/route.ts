// app/api/register/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const deviceId = cookies().get('device_id')?.value;
  if (!deviceId) {
    return NextResponse.json({ error: 'device id not provided' }, { status: 400 });
  }
  // ...use deviceId...
  return NextResponse.json({ ok: true, deviceId });
}
