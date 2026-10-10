import type { Transcript } from '@/types';
export interface TranscriptionProvider { transcribe(path: string, duration: number): Promise<Transcript> }
// TODO: implement a Whisper provider behind this interface. Never present mock text as actual speech.
export const mockTranscriber: TranscriptionProvider = { async transcribe(_path, duration) {
  const lines = ['The best ideas start with a simple question.', 'What if you could make more from what you already have?', 'Focus on the moments that make people stop and listen.'];
  return { provider: 'mock', text: lines.join(' '), segments: lines.map((text, i) => ({start: duration * i / 3, end: duration * (i + 1) / 3, text})) };
} };
