// Run with a server already running: node scripts/smoke.mjs /path/to/test.mp4
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = process.env.CLIPFORGE_TEST_URL || 'http://localhost:3000';
assert(process.argv[2], 'Provide a short test video path');
assert.equal((await fetch(base)).status, 200);
const invalid = new FormData(); invalid.append('video', new Blob(['bad']), 'bad.txt');
assert.equal((await fetch(`${base}/api/jobs`, {method:'POST', body:invalid})).status, 400);
const form = new FormData(); form.append('video', new Blob([await readFile(process.argv[2])]), 'test.mp4');
const response = await fetch(`${base}/api/jobs`, {method:'POST', body:form}); assert.equal(response.status, 201);
const {id} = await response.json(); let job;
for (let i=0;i<90;i++) {
  const status = await fetch(`${base}/api/jobs/${id}`); assert.equal(status.status, 200); job = await status.json();
  if(job.status==='Done'||job.status==='Failed') break;
  await new Promise(resolve=>setTimeout(resolve,1000));
}
assert.equal(job.status, 'Done', job.error); assert.equal(job.clips.length, 3);
for(const clip of job.clips) {
  const video = await fetch(base+clip.url); assert.equal(video.status,200); assert((await video.arrayBuffer()).byteLength>100);
  const range = await fetch(base+clip.url,{headers:{Range:'bytes=0-99'}}); assert.equal(range.status,206); assert.equal((await range.arrayBuffer()).byteLength,100);
  const captions = await fetch(`${base}/api/media/${id}/${clip.id}.srt`); assert.equal(captions.status,200); assert.match(await captions.text(),/Demo subtitle/);
}
assert.equal((await fetch(`${base}/results/${id}`)).status,200);
assert.equal((await fetch(`${base}/api/jobs/not-a-job`)).status,404);
console.log('PASS: upload validation, job completion, three exports, range playback, captions, results, missing job');
