import type { Metadata } from 'next';
import Link from 'next/link';
import { Clapperboard } from 'lucide-react';
import AccountNav from '@/components/account-nav';
import './globals.css';
export const metadata: Metadata = {title: 'ClipForge — длинное видео в короткие клипы', description: 'Загрузите видео и получите короткие клипы для соцсетей.'};
export default function Layout({children}: {children: React.ReactNode}) { return <html lang="ru"><body><header className="nav"><Link href="/" className="brand"><span className="brand-icon"><Clapperboard size={21}/></span>ClipForge<span className="beta">БЕТА</span></Link><nav><Link href="/#how">Как это работает</Link><AccountNav/></nav></header><main>{children}</main><footer><Link className="brand" href="/">ClipForge<span className="dot">✦</span></Link><span>Меньше монтажа. Больше творчества.</span><span>Создано для ваших лучших моментов.</span></footer></body></html> }
