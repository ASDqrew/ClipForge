import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import type { Segment } from '@/types';
const exec = promisify(execFile);
export async function readMetadata(path: string): Promise<{ duration: number }> {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', path]);
  const duration = Number(JSON.parse(stdout).format.duration);
  if (!Number.isFinite(duration) || duration < 1) throw new Error('Видео должно длиться не менее одной секунды.');
  return { duration };
}
export async function detectSilence(path: string) {
  const { stderr } = await exec('ffmpeg', ['-hide_banner', '-i', path, '-af', 'silencedetect=noise=-35dB:d=0.5', '-f', 'null', '-'], { maxBuffer: 10 * 1024 * 1024 });
  return stderr;
}
export async function removeSilence(input: string, output: string) {
  // TODO: map detected silence intervals to synchronized audio/video trims.
  // Audio-only silenceremove would desynchronize the talking-head video.
  void input; void output;
  throw new Error('Синхронное удаление пауз пока не реализовано.');
}
export async function cutClip(input: string, output: string, start: number, end: number) {
  await exec('ffmpeg', ['-y', '-ss', String(start), '-i', input, '-t', String(end - start), '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-vf', "scale='min(1280,iw)':-2", '-c:a', 'aac', '-movflags', '+faststart', output], { maxBuffer: 10 * 1024 * 1024 });
}
const timestamp = (seconds: number) => new Date(Math.max(0, seconds) * 1000).toISOString().slice(11, 23).replace('.', ',');
export async function writeSubtitles(path: string, segments: Segment[]) {
  await writeFile(path, segments.map((s, i) => `${i + 1}\n${timestamp(s.start)} --> ${timestamp(s.end)}\n${s.text}\n`).join('\n'));
}
export async function burnSubtitles(input: string, subtitles: string, output: string) {
  // Call with controlled internal paths only; never interpolate user filenames into filters.
  if (!/^[a-zA-Z0-9/_.-]+$/.test(subtitles)) throw new Error('Unsupported subtitle path');
  await exec('ffmpeg', ['-y', '-i', input, '-vf', `subtitles=${subtitles}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'copy', '-movflags', '+faststart', output], { maxBuffer: 10 * 1024 * 1024 });
}
