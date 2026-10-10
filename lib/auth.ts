import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
  googleId?: string;
  passwordHash?: string;
  createdAt: string;
};
type SessionRecord = { tokenHash: string; userId: string; expiresAt: string };
type OtpRecord = { codeHash: string; expiresAt: string; attempts: number };
type AuthStore = { users: AuthUser[]; sessions: SessionRecord[]; otps: Record<string, OtpRecord> };
export type AuthSession = { user: Omit<AuthUser, 'passwordHash' | 'googleId'>; session: { expiresAt: string } };

const dataDirectory = path.join(process.cwd(), 'data');
const storeFile = path.join(dataDirectory, 'auth.json');
const cookieName = 'clipforge_session';
mkdirSync(dataDirectory, { recursive: true });

function readStore(): AuthStore {
  try { return JSON.parse(readFileSync(storeFile, 'utf8')); }
  catch { return { users: [], sessions: [], otps: {} }; }
}

function writeStore(store: AuthStore) {
  const temporary = `${storeFile}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(store), { mode: 0o600 });
  renameSync(temporary, storeFile);
}

function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function publicUser(user: AuthUser): AuthSession['user'] {
  const {passwordHash, googleId, ...safe} = user; void passwordHash; void googleId; return safe;
}
function parseCookies(headers: Headers) {
  return Object.fromEntries((headers.get('cookie') || '').split(';').map((item) => item.trim().split('=').map(decodeURIComponent)).filter((pair) => pair.length === 2));
}
function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure ? '; Secure' : ''}`;
}
export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function createPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, encoded = '') {
  const [salt, stored] = encoded.split(':');
  if (!salt || !stored) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getAuthSession(headers: Headers): AuthSession | null {
  const token = parseCookies(headers)[cookieName];
  if (!token) return null;
  const store = readStore();
  const record = store.sessions.find((session) => session.tokenHash === hash(token) && new Date(session.expiresAt) > new Date());
  const user = record && store.users.find((candidate) => candidate.id === record.userId);
  return user && record ? { user: publicUser(user), session: { expiresAt: record.expiresAt } } : null;
}

export function createSessionResponse(user: AuthUser, request: Request) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const store = readStore();
  store.sessions = store.sessions.filter((session) => new Date(session.expiresAt) > new Date());
  store.sessions.push({ tokenHash: hash(token), userId: user.id, expiresAt });
  writeStore(store);
  return Response.json({ user: publicUser(user) }, { headers: { 'Set-Cookie': sessionCookie(token, request) } });
}

export function registerEmail(name: string, email: string, password: string) {
  const store = readStore();
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error('Введите корректный адрес электронной почты.');
  if (name.trim().length < 2) throw new Error('Введите имя.');
  if (password.length < 8) throw new Error('Пароль должен содержать не менее 8 символов.');
  if (store.users.some((user) => user.email === normalized)) throw new Error('Аккаунт с такой почтой уже существует.');
  const user: AuthUser = { id: randomUUID(), name: name.trim(), email: normalized, emailVerified: false, passwordHash: createPassword(password), createdAt: new Date().toISOString() };
  store.users.push(user); writeStore(store); return user;
}

export function loginEmail(email: string, password: string) {
  const store = readStore();
  const user = store.users.find((candidate) => candidate.email === email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) throw new Error('Неверная почта или пароль.');
  return user;
}

export function destroySession(headers: Headers) {
  const token = parseCookies(headers)[cookieName];
  if (!token) return;
  const store = readStore();
  store.sessions = store.sessions.filter((session) => session.tokenHash !== hash(token));
  writeStore(store);
}

async function sendSms(phone: string, code: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error('Вход по телефону пока не настроен администратором.');
  const body = new URLSearchParams({To: phone, From: from, Body: `Код входа в ClipForge: ${code}. Никому его не сообщайте.`});
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {method:'POST', headers:{Authorization:`Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'}, body});
  if (!response.ok) throw new Error('Не удалось отправить SMS-код.');
}

export async function sendPhoneOtp(rawPhone: string) {
  const parsed = parsePhoneNumberFromString(rawPhone);
  if (!parsed?.isValid()) throw new Error('Введите корректный номер телефона.');
  const phone = parsed.number;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await sendSms(phone, code);
  const store = readStore();
  store.otps[phone] = {codeHash: hash(code), expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), attempts: 0};
  writeStore(store); return phone;
}

export function verifyPhoneOtp(rawPhone: string, code: string) {
  const parsed = parsePhoneNumberFromString(rawPhone);
  if (!parsed?.isValid()) throw new Error('Введите корректный номер телефона.');
  const phone = parsed.number;
  const store = readStore();
  const otp = store.otps[phone];
  if (!otp || new Date(otp.expiresAt) < new Date() || otp.attempts >= 5) throw new Error('Код истёк. Запросите новый.');
  if (otp.codeHash !== hash(code)) { otp.attempts += 1; writeStore(store); throw new Error('Неверный код.'); }
  delete store.otps[phone];
  let user = store.users.find((candidate) => candidate.phoneNumber === phone);
  if (!user) {
    user = {id:randomUUID(), name:`Пользователь ${phone.slice(-4)}`, email:`${phone.replace(/\D/g,'')}@phone.clipforge.local`, emailVerified:false, phoneNumber:phone, phoneNumberVerified:true, createdAt:new Date().toISOString()};
    store.users.push(user);
  }
  writeStore(store); return user;
}

export function upsertGoogleUser(profile: {sub:string; email:string; name?:string; picture?:string; email_verified?:boolean}) {
  const store = readStore();
  const email = profile.email.toLowerCase();
  let user = store.users.find((candidate) => candidate.googleId === profile.sub || candidate.email === email);
  if (user) { user.googleId = profile.sub; user.emailVerified = Boolean(profile.email_verified); user.image = profile.picture || user.image; }
  else { user = {id:randomUUID(), googleId:profile.sub, name:profile.name || email.split('@')[0], email, emailVerified:Boolean(profile.email_verified), image:profile.picture, createdAt:new Date().toISOString()}; store.users.push(user); }
  writeStore(store); return user;
}

export const authProviders = {
  email: true,
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  phone: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
};
