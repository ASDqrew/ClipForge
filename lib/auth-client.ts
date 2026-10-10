'use client';

import { useEffect, useState } from 'react';

type ClientResult<T = unknown> = { data: T | null; error: {message: string} | null };
let cachedSession: {user: {id:string; name:string; email:string}} | null | undefined;

async function request<T>(path: string, body?: unknown): Promise<ClientResult<T>> {
  const response = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : {'Content-Type':'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return {data:null, error:{message:data?.message || 'Не удалось выполнить запрос.'}};
  window.dispatchEvent(new Event('clipforge-auth-change'));
  return {data, error:null};
}

function useSession() {
  const [data, setData] = useState<typeof cachedSession>(cachedSession);
  const [isPending, setPending] = useState(cachedSession === undefined);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch('/api/auth/get-session', {cache:'no-store'});
      const session = response.ok ? await response.json() : null;
      cachedSession = session;
      if (active) { setData(session); setPending(false); }
    };
    load(); window.addEventListener('clipforge-auth-change', load);
    return () => { active = false; window.removeEventListener('clipforge-auth-change', load); };
  }, []);
  return {data, isPending};
}

export const authClient = {
  useSession,
  signUp: { email: (body: {name:string; email:string; password:string}) => request('sign-up/email', body) },
  signIn: {
    email: (body: {email:string; password:string}) => request('sign-in/email', body),
    social: async ({provider, callbackURL}: {provider:string; callbackURL:string}) => {
      window.location.href = `/api/auth/${provider}?callbackURL=${encodeURIComponent(callbackURL)}`;
      return {data:null, error:null};
    },
  },
  signOut: () => request('sign-out', {}),
  phoneNumber: {
    sendOtp: (body: {phoneNumber:string}) => request('phone-number/send-otp', body),
    verify: (body: {phoneNumber:string; code:string}) => request('phone-number/verify', body),
  },
};
