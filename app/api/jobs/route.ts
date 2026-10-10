import { NextResponse, after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, prepareDirectory, saveJob, processJob } from '@/lib/jobs';
import type { Job } from '@/types';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get('content-length'));
    if (length > 200 * 1024 * 1024) return NextResponse.json({error: 'Maximum upload size is 200 MB.'}, {status: 413});
    const form = await request.formData(); const file = form.get('video');
    if (!(file instanceof File) || !/\.(mp4|mov|webm)$/i.test(file.name) || file.size === 0) return NextResponse.json({error: 'Choose a non-empty MP4, MOV, or WebM video.'}, {status: 400});
    if (file.size > 200 * 1024 * 1024) return NextResponse.json({error: 'Maximum upload size is 200 MB.'}, {status: 413});
    const id = randomUUID(); await prepareDirectory(id);
    const source = path.join(root, id, 'source.' + file.name.split('.').pop()!.toLowerCase());
    await writeFile(source, Buffer.from(await file.arrayBuffer()));
    const job: Job = {id, filename: file.name, source, status: 'Uploaded', clips: [], createdAt: new Date().toISOString()};
    await saveJob(job); after(() => processJob(job));
    return NextResponse.json({id}, {status: 201});
  } catch { return NextResponse.json({error: 'Upload failed. Please try again.'}, {status: 500}); }
}
