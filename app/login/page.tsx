import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAuthSession } from '@/lib/auth';
import AuthForm from '@/components/auth-form';

export default async function LoginPage() {
  const session = getAuthSession(await headers());
  if (session) redirect('/dashboard');
  return <div className="page auth-page">
    <Link href="/" className="back"><ArrowLeft size={14}/> На главную</Link>
    <div className="auth-heading"><div className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</div><h1>Войдите в ClipForge</h1><p className="page-desc">Ваши видео, задачи и готовые клипы будут собраны в одном месте.</p></div>
    <AuthForm/>
  </div>;
}
