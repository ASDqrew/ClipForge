import type { Transcript } from '@/types';
export interface TranscriptionProvider { transcribe(path: string, duration: number): Promise<Transcript> }
// TODO: implement a Whisper provider behind this interface. Never present mock text as actual speech.
export const mockTranscriber: TranscriptionProvider = { async transcribe(_path, duration) {
  const lines = ['Лучшие идеи начинаются с простого вопроса.', 'Что, если использовать по-новому то, что у вас уже есть?', 'Сосредоточьтесь на моментах, которые заставляют остановиться и досмотреть.'];
  return { provider: 'mock', text: lines.join(' '), segments: lines.map((text, i) => ({start: duration * i / 3, end: duration * (i + 1) / 3, text})) };
} };
