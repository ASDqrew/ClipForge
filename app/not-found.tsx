import Link from 'next/link';
export default function NotFound(){return <div className="page empty"><h1>Такой страницы нет</h1><p className="page-desc">Вернитесь в ClipForge и создайте новый клип.</p><Link href="/" className="primary">На главную</Link></div>}
