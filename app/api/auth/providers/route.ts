import { NextResponse } from 'next/server';
import { authProviders } from '@/lib/auth';

export const runtime = 'nodejs';
export function GET() {
  return NextResponse.json(authProviders, { headers: { 'Cache-Control': 'no-store' } });
}
