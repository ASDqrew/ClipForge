# ClipForge

Next.js / TypeScript / Tailwind MVP with local storage and real FFmpeg clip exports.

## Run

Requires Node.js 22+ and FFmpeg/FFprobe on PATH.

```sh
npm ci
npm run dev
```

Open the development server, upload an MP4/MOV/WebM (up to 200 MB), watch processing, then preview and download three clips and demo SRT files.

Validation: `npm run typecheck` and `npm run build`. Production: `npm run build && npm start`.

## Architecture

- `app/`: landing, upload, processing/results, and Node API routes
- `components/`: polling job view
- `lib/jobs/`: atomic JSON persistence and background pipeline
- `lib/video/`: FFprobe metadata, FFmpeg exports, silence detection and subtitle helpers
- `lib/transcription/`: replaceable mock transcription provider
- `lib/highlights/`: mock timestamp suggestions
- `types/`: shared job, transcript, segment and clip models

Files live in ignored `data/<job-id>/`. Jobs run after the upload response via Next.js `after`. Run on a persistent Node server, not ephemeral serverless hosting. Live jobs are not durable across a server restart; there is no queue recovery in this MVP. Keep concurrent uploads low: uploads/serving are buffered in memory, and FFmpeg work is local. There is no authentication or automatic retention cleanup; use test videos and delete `data/` manually when no jobs are running.

## Mock boundaries / next steps

Transcription and highlight selection are explicitly mocked. Clips are real timestamp cuts, preserving source aspect ratio. SRT downloads contain labeled demo captions. Silence removal is a scaffold that throws until synchronized audio/video trimming is implemented. Burn-in utility exists but is not connected to demo exports. Connect real transcription, LLM highlights, accurate caption burn-in, vertical reframing, a durable bounded queue, streaming uploads/downloads and cleanup before production use.

No accounts, payments, database, or timeline editor are included.

Functional smoke test (server running): `node scripts/smoke.mjs /path/to/short-test.mp4`. It creates a local job and checks validation, completion, three downloads, byte ranges, subtitles, results and missing-job responses.
