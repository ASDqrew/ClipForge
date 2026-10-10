import { getJob } from '@/lib/jobs';
import { getAuthSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const session = getAuthSession(request.headers);
  if (!session) return NextResponse.json({error: 'Требуется авторизация'}, {status: 401});
  const job = await getJob((await params).id);
  if (!job || job.userId !== session.user.id) return NextResponse.json({error: 'Задача не найдена'}, {status: 404});
  const {source, userId, ...publicJob} = job; void source; void userId;
  return NextResponse.json(publicJob, {headers: {'Cache-Control': 'no-store'}});
}
