import { getJob } from '@/lib/jobs';
import { NextResponse } from 'next/server';
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const job = await getJob((await params).id);
  if (!job) return NextResponse.json({error: 'Job not found'}, {status: 404});
  const {source, ...publicJob} = job; void source;
  return NextResponse.json(publicJob, {headers: {'Cache-Control': 'no-store'}});
}
