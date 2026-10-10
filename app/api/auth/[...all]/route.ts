import { randomBytes } from 'node:crypto';
import {
  authProviders,
  clearSessionCookie,
  createSessionResponse,
  destroySession,
  getAuthSession,
  loginEmail,
  registerEmail,
  sendPhoneOtp,
  upsertGoogleUser,
  verifyPhoneOtp,
} from '@/lib/auth';

export const runtime = 'nodejs';

function errorResponse(error: unknown, status = 400) {
  return Response.json({message:error instanceof Error ? error.message : 'Не удалось выполнить запрос.'}, {status});
}
function safeCallback(value: string | null) { return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'; }
function baseUrl(request: Request) { return process.env.BETTER_AUTH_URL || new URL(request.url).origin; }
function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (process.env.BETTER_AUTH_URL && origin === new URL(process.env.BETTER_AUTH_URL).origin) return true;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: Request, {params}: {params: Promise<{all:string[]}>}) {
  if (!checkOrigin(request)) return errorResponse(new Error('Недопустимый источник запроса.'), 403);
  const route = (await params).all.join('/');
  try {
    const body = await request.json();
    if (route === 'sign-up/email') return createSessionResponse(registerEmail(body.name || '', body.email || '', body.password || ''), request);
    if (route === 'sign-in/email') return createSessionResponse(loginEmail(body.email || '', body.password || ''), request);
    if (route === 'sign-out') { destroySession(request.headers); return Response.json({success:true}, {headers:{'Set-Cookie':clearSessionCookie(request)}}); }
    if (route === 'phone-number/send-otp') { await sendPhoneOtp(body.phoneNumber || ''); return Response.json({success:true}); }
    if (route === 'phone-number/verify') return createSessionResponse(verifyPhoneOtp(body.phoneNumber || '', body.code || ''), request);
    return errorResponse(new Error('Маршрут не найден.'), 404);
  } catch (error) { return errorResponse(error); }
}

export async function GET(request: Request, {params}: {params: Promise<{all:string[]}>}) {
  const route = (await params).all.join('/');
  if (route === 'get-session') return Response.json(getAuthSession(request.headers));
  if (route === 'google') {
    if (!authProviders.google) return errorResponse(new Error('Вход через Google не настроен.'), 503);
    const state = randomBytes(24).toString('base64url');
    const callbackURL = safeCallback(new URL(request.url).searchParams.get('callbackURL'));
    const redirectUri = `${baseUrl(request)}/api/auth/google/callback`;
    const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    target.search = new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!, redirect_uri:redirectUri, response_type:'code', scope:'openid email profile', state, prompt:'select_account'}).toString();
    return new Response(null, {status:302, headers:{Location:target.toString(), 'Set-Cookie':`clipforge_oauth=${state}.${encodeURIComponent(callbackURL)}; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=600`}});
  }
  if (route === 'google/callback') {
    try {
      const url = new URL(request.url); const code = url.searchParams.get('code'); const state = url.searchParams.get('state');
      const oauthCookie = (request.headers.get('cookie') || '').split(';').map((item) => item.trim()).find((item) => item.startsWith('clipforge_oauth='))?.slice('clipforge_oauth='.length);
      const [expectedState, encodedCallback = ''] = decodeURIComponent(oauthCookie || '').split('.');
      if (!code || !state || state !== expectedState) throw new Error('Не удалось проверить вход Google.');
      const redirectUri = `${baseUrl(request)}/api/auth/google/callback`;
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({code, client_id:process.env.GOOGLE_CLIENT_ID!, client_secret:process.env.GOOGLE_CLIENT_SECRET!, redirect_uri:redirectUri, grant_type:'authorization_code'})});
      if (!tokenResponse.ok) throw new Error('Google не подтвердил вход.');
      const tokens = await tokenResponse.json();
      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {headers:{Authorization:`Bearer ${tokens.access_token}`}});
      if (!profileResponse.ok) throw new Error('Не удалось получить профиль Google.');
      const sessionResponse = createSessionResponse(upsertGoogleUser(await profileResponse.json()), request);
      const headers = new Headers(sessionResponse.headers); headers.set('Location', new URL(safeCallback(decodeURIComponent(encodedCallback)), baseUrl(request)).toString());
      return new Response(null, {status:302, headers});
    } catch (error) { return errorResponse(error); }
  }
  return errorResponse(new Error('Маршрут не найден.'), 404);
}
