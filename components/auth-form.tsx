'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, Phone, ShieldCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

type Mode = 'email' | 'phone';
type Providers = { email: boolean; google: boolean; phone: boolean };

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('email');
  const [providers, setProviders] = useState<Providers>({email: true, google: false, phone: false});
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+7');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetch('/api/auth/providers').then((response) => response.json()).then(setProviders).catch(() => undefined); }, []);
  const finish = () => { router.push('/dashboard'); router.refresh(); };

  async function submitEmail(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const result = register
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) return setError(result.error.message || 'Не удалось войти. Проверьте данные.');
    finish();
  }

  async function google() {
    setError('');
    if (!providers.google) return setError('Вход через Google ещё не настроен. Добавьте OAuth-ключи в .env.local.');
    await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
  }

  async function submitPhone(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    if (!providers.phone) { setBusy(false); return setError('SMS-вход ещё не настроен. Добавьте ключи Twilio в .env.local.'); }
    if (!codeSent) {
      const result = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
      setBusy(false);
      if (result.error) return setError(result.error.message || 'Не удалось отправить код.');
      setCodeSent(true); return;
    }
    const result = await authClient.phoneNumber.verify({ phoneNumber: phone, code });
    setBusy(false);
    if (result.error) return setError(result.error.message || 'Неверный или просроченный код.');
    finish();
  }

  return <div className="auth-card">
    <div className="auth-tabs">
      <button className={mode === 'email' ? 'active' : ''} onClick={() => {setMode('email'); setError('');}}><Mail size={15}/> Почта</button>
      <button className={mode === 'phone' ? 'active' : ''} onClick={() => {setMode('phone'); setError('');}}><Phone size={15}/> Телефон</button>
    </div>
    {mode === 'email' ? <>
      <form onSubmit={submitEmail} className="auth-form">
        {register && <label>Имя<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" placeholder="Как к вам обращаться"/></label>}
        <label>Электронная почта<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="name@example.com"/></label>
        <label>Пароль<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={register ? 'new-password' : 'current-password'} placeholder="Не менее 8 символов"/></label>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button className="primary wide" disabled={busy}>{busy ? 'Подождите…' : register ? 'Создать аккаунт' : 'Войти'}<ArrowRight size={16}/></button>
      </form>
      <button className="text-button" onClick={() => {setRegister(!register); setError('');}}>{register ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}</button>
      <div className="auth-divider"><span>или</span></div>
      <button className="google-button" onClick={google} disabled={!providers.google}><span className="google-mark">G</span> Продолжить с Google</button>
      {!providers.google && <p className="provider-note">Google OAuth можно включить в настройках окружения.</p>}
    </> : <form onSubmit={submitPhone} className="auth-form">
      <label>Номер телефона<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required disabled={codeSent} autoComplete="tel" placeholder="+7 900 000-00-00"/></label>
      {codeSent && <label>Код из SMS<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" autoComplete="one-time-code" placeholder="000000"/></label>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary wide" disabled={busy || !providers.phone}>{busy ? 'Подождите…' : codeSent ? 'Подтвердить и войти' : 'Получить код'}<ArrowRight size={16}/></button>
      {codeSent && <button type="button" className="text-button" onClick={() => {setCodeSent(false); setCode('');}}>Изменить номер</button>}
      {!providers.phone && <p className="provider-note">SMS-вход станет доступен после подключения Twilio.</p>}
    </form>}
    <p className="auth-safe"><ShieldCheck size={14}/> Сессия хранится в защищённой HTTP-only cookie.</p>
  </div>;
}
