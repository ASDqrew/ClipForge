import type { Clip, Transcript } from '@/types';
// TODO: replace evenly spaced suggestions with an LLM using the transcript and validated timestamps.
export async function detectHighlights(transcript: Transcript, duration: number): Promise<Clip[]> {
  return ['The idea that changes everything', 'A different way to think', 'The takeaway worth sharing'].map((title, i) => {
    const start = duration * i / 3;
    return {id: String(i + 1), start, end: Math.min(duration, start + Math.min(30, duration / 3)), title, hook: transcript.segments[i].text, reason: 'Demo suggestion selected from an evenly spaced section of your video.'};
  });
}
