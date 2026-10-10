export type Segment = { start: number; end: number; text: string };
export type Transcript = { text: string; segments: Segment[]; provider: 'mock' };
export type Clip = { id: string; start: number; end: number; title: string; hook: string; reason: string; url?: string };
export const steps = ['Uploaded', 'Transcribing', 'Detecting pauses', 'Finding highlights', 'Generating subtitles', 'Exporting clips', 'Done'] as const;
export type Job = { id: string; filename: string; source: string; status: typeof steps[number] | 'Failed'; duration?: number; clips: Clip[]; transcript?: Transcript; error?: string; createdAt: string };
