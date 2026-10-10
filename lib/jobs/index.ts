import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { Job } from '@/types';
import { readMetadata, cutClip, writeSubtitles } from '@/lib/video/ffmpeg';
import { mockTranscriber } from '@/lib/transcription';
import { detectHighlights } from '@/lib/highlights';
export const root = path.join(process.cwd(), 'data');
export async function saveJob(job: Job) {
  const file = path.join(root, job.id, 'job.json');
  await writeFile(file + '.tmp', JSON.stringify(job)); await rename(file + '.tmp', file);
}
export async function getJob(id: string): Promise<Job | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  try { return JSON.parse(await readFile(path.join(root, id, 'job.json'), 'utf8')); } catch { return null; }
}
export async function processJob(job: Job) {
  const update = async (status: Job['status']) => {job.status = status; await saveJob(job);};
  try {
    job.duration = (await readMetadata(job.source)).duration;
    await update('Transcribing'); job.transcript = await mockTranscriber.transcribe(job.source, job.duration);
    await update('Detecting pauses'); // TODO: use detectSilence + synchronized trim plan; demo leaves pauses intact.
    await update('Finding highlights'); job.clips = await detectHighlights(job.transcript, job.duration);
    await update('Generating subtitles');
    for (const clip of job.clips) await writeSubtitles(path.join(root, job.id, `${clip.id}.srt`), [{start: 0, end: clip.end - clip.start, text: '[Demo subtitle] ' + clip.hook}]);
    await update('Exporting clips');
    for (const clip of job.clips) {
      await cutClip(job.source, path.join(root, job.id, `${clip.id}.mp4`), clip.start, clip.end);
      clip.url = `/api/media/${job.id}/${clip.id}.mp4`;
      // TODO: burnSubtitles after real transcription; demo captions are downloadable sidecars.
      await saveJob(job);
    }
    await update('Done');
  } catch (error) { job.error = error instanceof Error ? error.message.slice(0, 300) : 'Processing failed'; await update('Failed'); }
}
export async function prepareDirectory(id: string) { await mkdir(path.join(root, id), {recursive: true}); }
