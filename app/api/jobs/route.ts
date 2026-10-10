import { NextResponse, after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { root, prepareDirectory, saveJob, processJob } from '@/lib/jobs';
import { auth } from '@/lib/auth';
import type { Job } from '@/types';
export const runtime = 'nodejs';
const MAX_UPLOAD_SIZE = 2 * 1024 * 1024 * 1024;
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({error: 'Войдите в аккаунт, чтобы загрузить видео.'}, {status: 401});
  let jobDirectory = '';
  try {
    const length = Number(request.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_UPLOAD_SIZE) return NextResponse.json({error: 'Максимальный размер видео — 2 ГБ.'}, {status: 413});
    const encodedName = request.headers.get('x-file-name');
    if (!encodedName || !request.body) return NextResponse.json({error: 'Видео не найдено в запросе.'}, {status: 400});
    let decodedName = '';
    try { decodedName = decodeURIComponent(encodedName); } catch { return NextResponse.json({error: 'Некорректное имя файла.'}, {status: 400}); }
    const filename = path.basename(decodedName).replace(/[\u0000-\u001f]/g, '').slice(0, 180);
    const extension = path.extname(filename).toLowerCase();
    if (!['.mp4', '.mov', '.webm'].includes(extension)) return NextResponse.json({error: 'Выберите видео MP4, MOV или WebM.'}, {status: 400});
    const id = randomUUID(); await prepareDirectory(id);
    jobDirectory = path.join(root, id);
    const source = path.join(jobDirectory, `source${extension}`);
    let received = 0;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        callback(received > MAX_UPLOAD_SIZE ? new Error('UPLOAD_TOO_LARGE') : null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(request.body as never), limiter, createWriteStream(source, { flags: 'wx' }));
    if (received === 0) throw new Error('EMPTY_UPLOAD');
    const job: Job = {id, userId: session.user.id, filename, source, status: 'Uploaded', clips: [], createdAt: new Date().toISOString()};
    await saveJob(job); after(() => processJob(job));
    return NextResponse.json({id}, {status: 201});
  } catch (error) {
    if (jobDirectory) await rm(jobDirectory, { recursive: true, force: true });
    if (error instanceof Error && error.message === 'UPLOAD_TOO_LARGE') return NextResponse.json({error: 'Максимальный размер видео — 2 ГБ.'}, {status: 413});
    if (error instanceof Error && error.message === 'EMPTY_UPLOAD') return NextResponse.json({error: 'Файл пуст.'}, {status: 400});
    return NextResponse.json({error: 'Не удалось загрузить видео. Попробуйте ещё раз.'}, {status: 500});
  }
}
