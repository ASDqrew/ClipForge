import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { root } from '@/lib/jobs';
export const runtime = 'nodejs';
export async function GET(request: Request, context: {params: Promise<{path: string[]}>}) {
  const parts = (await context.params).path;
  if (parts.length !== 2 || !/^[0-9a-f-]{36}$/.test(parts[0]) || !/^[123]\.(mp4|srt)$/.test(parts[1])) return new Response('Not found', {status: 404});
  const file = path.join(root, ...parts);
  try {
    const {size} = await stat(file); const range = request.headers.get('range');
    let start = 0, end = size - 1;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`}});
      start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end;
      if (start > end || start >= size) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`}});
    }
    const handle = await open(file); const buffer = Buffer.alloc(end - start + 1);
    try { await handle.read(buffer, 0, buffer.length, start); } finally { await handle.close(); }
    const headers: Record<string, string> = {'Content-Type': file.endsWith('.mp4') ? 'video/mp4' : 'application/x-subrip', 'Content-Length': String(buffer.length), 'Accept-Ranges': 'bytes'};
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    if (new URL(request.url).searchParams.has('download')) headers['Content-Disposition'] = `attachment; filename="clip-${parts[1]}"`;
    return new Response(buffer, {status: range ? 206 : 200, headers});
  } catch { return new Response('Not found', {status: 404}); }
}
