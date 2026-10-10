'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export default function SignOutButton() {
  const router = useRouter();
  return <button className="secondary" onClick={async () => { await authClient.signOut(); router.push('/'); router.refresh(); }}><LogOut size={14}/> Выйти</button>;
}
