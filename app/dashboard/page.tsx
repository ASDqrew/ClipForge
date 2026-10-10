import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Clock3, Film, Plus, Sparkles } from 'lucide-react';
import { getAuthSession } from '@/lib/auth';
import { listJobs } from '@/lib/jobs';
import SignOutButton from '@/components/sign-out-button';

const statusLabels: Record<string, string> = {Uploaded:'Загружено',Transcribing:'Расшифровка', 'Detecting pauses':'Поиск пауз', 'Finding highlights':'Поиск моментов', 'Generating subtitles':'Создание субтитров', 'Exporting clips':'Экспорт', Done:'Готово', Failed:'Ошибка'};

export default async function DashboardPage() {
  const session = getAuthSession(await headers());
  if (!session) redirect('/login');
  const jobs = await listJobs(session.user.id);
  return <div className="page dashboard">
    <div className="dashboard-head"><div><div className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</div><h1>Здравствуйте, {session.user.name}</h1><p className="page-desc">Здесь хранятся ваши загрузки и готовые клипы.</p></div><SignOutButton/></div>
    <div className="dashboard-stats"><div><Film/><span><strong>{jobs.length}</strong> видео</span></div><div><Sparkles/><span><strong>{jobs.filter((job) => job.status === 'Done').length * 3}</strong> готовых клипов</span></div></div>
    <div className="dashboard-title"><h2>Мои видео</h2><Link href="/upload" className="primary"><Plus size={16}/> Загрузить видео</Link></div>
    {jobs.length ? <div className="job-list">{jobs.map((job) => <Link href={job.status === 'Done' ? `/results/${job.id}` : `/jobs/${job.id}`} className="job-row" key={job.id}><span className="job-icon"><Film size={20}/></span><span className="job-info"><strong>{job.filename}</strong><small><Clock3 size={12}/> {new Intl.DateTimeFormat('ru-RU', {dateStyle:'medium', timeStyle:'short'}).format(new Date(job.createdAt))}</small></span><span className={`job-status ${job.status === 'Done' ? 'done' : job.status === 'Failed' ? 'failed' : ''}`}>{statusLabels[job.status] || job.status}</span></Link>)}</div> : <div className="empty-state"><Film size={34}/><h3>Здесь пока пусто</h3><p>Загрузите первое видео — ClipForge подготовит три коротких фрагмента.</p><Link href="/upload" className="primary">Загрузить видео</Link></div>}
  </div>;
}
