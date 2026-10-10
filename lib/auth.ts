import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import { betterAuth } from 'better-auth';
import { phoneNumber } from 'better-auth/plugins';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const dataDirectory = path.join(process.cwd(), 'data');
mkdirSync(dataDirectory, { recursive: true });
const secretFile = path.join(dataDirectory, '.auth-secret');
function localSecret() {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  try { return readFileSync(secretFile, 'utf8').trim(); } catch {
    const generated = randomBytes(48).toString('base64url');
    try { writeFileSync(secretFile, generated, { mode: 0o600, flag: 'wx' }); return generated; }
    catch { return readFileSync(secretFile, 'utf8').trim(); }
  }
}
const authSecret = localSecret();
const database = new Database(path.join(dataDirectory, 'auth.sqlite'));
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL,
    image TEXT,
    createdAt date NOT NULL,
    updatedAt date NOT NULL,
    phoneNumber TEXT UNIQUE,
    phoneNumberVerified INTEGER
  );
  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY NOT NULL,
    expiresAt date NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt date NOT NULL,
    updatedAt date NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS session_userId_idx ON session(userId);
  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY NOT NULL,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt date,
    refreshTokenExpiresAt date,
    scope TEXT,
    password TEXT,
    createdAt date NOT NULL,
    updatedAt date NOT NULL
  );
  CREATE INDEX IF NOT EXISTS account_userId_idx ON account(userId);
  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY NOT NULL,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt date NOT NULL,
    createdAt date NOT NULL,
    updatedAt date NOT NULL
  );
  CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);
`);

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

async function sendSms(phone: string, code: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new Error('Вход по телефону пока не настроен администратором.');
  }

  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: `Код входа в ClipForge: ${code}. Никому его не сообщайте.`,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) throw new Error('Не удалось отправить SMS-код.');
}

export const auth = betterAuth({
  database,
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders: googleConfigured
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
    : {},
  plugins: [
    phoneNumber({
      sendOTP: ({ phoneNumber: phone, code }) => sendSms(phone, code),
      expiresIn: 300,
      allowedAttempts: 5,
      phoneNumberValidator: (phone) => Boolean(parsePhoneNumberFromString(phone)?.isValid()),
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace(/\D/g, '')}@phone.clipforge.local`,
        getTempName: (phone) => `Пользователь ${phone.slice(-4)}`,
      },
    }),
  ],
});

export const authProviders = {
  email: true,
  google: googleConfigured,
  phone: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
};
