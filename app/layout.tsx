import type { Metadata } from 'next';
import Link from 'next/link';
import { Clapperboard, ArrowUpRight } from 'lucide-react';
import './globals.css';
export const metadata: Metadata = {title: 'ClipForge — Make every moment count', description: 'Turn long videos into short viral clips.'};
export default function Layout({children}: {children: React.ReactNode}) { return <html lang="en"><body><header className="nav"><Link href="/" className="brand"><span className="brand-icon"><Clapperboard size={21}/></span>ClipForge<span className="beta">BETA</span></Link><nav><Link href="/#how">How it works</Link><Link href="/upload" className="nav-cta">Create a clip <ArrowUpRight size={15}/></Link></nav></header><main>{children}</main><footer><Link className="brand" href="/">ClipForge<span className="dot">✦</span></Link><span>Less editing. More creating.</span><span>Built for your next big moment.</span></footer></body></html> }
