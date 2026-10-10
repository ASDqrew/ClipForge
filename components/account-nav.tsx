'use client';

import Link from 'next/link';
import { LogIn, UserRound } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export default function AccountNav() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <span className="account-loading">…</span>;
  if (session) return <Link href="/dashboard" className="nav-cta"><UserRound size={15}/> Кабинет</Link>;
  return <Link href="/login" className="nav-cta"><LogIn size={15}/> Войти</Link>;
}
