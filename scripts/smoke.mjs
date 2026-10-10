// Запуск при работающем сервере: node scripts/smoke.mjs /path/to/test.mp4
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const base = process.env.CLIPFORGE_TEST_URL || 'http://localhost:3000';
assert(process.argv[2], 'Укажите путь к короткому тестовому видео');
assert.equal((await fetch(base)).status, 200);

const unauthenticated = await fetch(`${base}/api/jobs`, {method: 'POST', body: new Blob(['bad'])});
assert.equal(unauthenticated.status, 401);

const identity = `smoke-${Date.now()}@example.com`;
const signup = await fetch(`${base}/api/auth/sign-up/email`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', Origin: base},
  body: JSON.stringify({name: 'Smoke Test', email: identity, password: 'Smoke-test-password-123'}),
});
assert.equal(signup.status, 200, await signup.text());
const cookie = signup.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
assert(cookie, 'Сессионная cookie не установлена');

const invalid = await fetch(`${base}/api/jobs`, {
  method: 'POST',
  headers: {Cookie: cookie, 'X-File-Name': encodeURIComponent('bad.txt'), 'Content-Type': 'text/plain'},
  body: new Blob(['bad']),
});
assert.equal(invalid.status, 400);

const video = await readFile(process.argv[2]);
const response = await fetch(`${base}/api/jobs`, {
  method: 'POST',
  headers: {Cookie: cookie, 'X-File-Name': encodeURIComponent('тест.mp4'), 'Content-Type': 'video/mp4'},
  body: video,
});
if (response.status !== 201) throw new Error(`Загрузка завершилась с ${response.status}: ${await response.text()}`);
const {id} = await response.json();
let job;
for (let index = 0; index < 90; index++) {
  const status = await fetch(`${base}/api/jobs/${id}`, {headers: {Cookie: cookie}});
  assert.equal(status.status, 200);
  job = await status.json();
  if (job.status === 'Done' || job.status === 'Failed') break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.equal(job.status, 'Done', job.error);
assert.equal(job.clips.length, 3);
for (const clip of job.clips) {
  const mediaUrl = base + clip.url;
  assert.equal((await fetch(mediaUrl)).status, 401);
  const file = await fetch(mediaUrl, {headers: {Cookie: cookie}});
  assert.equal(file.status, 200);
  assert((await file.arrayBuffer()).byteLength > 100);
  const range = await fetch(mediaUrl, {headers: {Cookie: cookie, Range: 'bytes=0-99'}});
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 100);
  const captions = await fetch(`${base}/api/media/${id}/${clip.id}.srt`, {headers: {Cookie: cookie}});
  assert.equal(captions.status, 200);
  assert.match(await captions.text(), /Демо-субтитры/);
}
assert.equal((await fetch(`${base}/results/${id}`, {headers: {Cookie: cookie}})).status, 200);
assert.equal((await fetch(`${base}/api/jobs/not-a-job`, {headers: {Cookie: cookie}})).status, 404);
console.log('PASS: аккаунт, защита API, потоковая загрузка, три клипа, range-запросы, субтитры и результаты');
