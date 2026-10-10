'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, LoaderCircle, ArrowLeft, Download } from 'lucide-react';
import { steps, type Job } from '@/types';

const labels: Record<string, string> = {
  Uploaded: 'Видео загружено',
  Transcribing: 'Расшифровываем речь',
  'Detecting pauses': 'Ищем паузы',
  'Finding highlights': 'Находим яркие моменты',
  'Generating subtitles': 'Создаём субтитры',
  'Exporting clips': 'Экспортируем клипы',
  Done: 'Готово',
};

export default function JobView({id, results = false}: {id: string; results?: boolean}) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState('');
  const router = useRouter();

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/jobs/${id}`, {cache: 'no-store'});
        if (response.status === 401) { router.replace('/login'); return; }
        if (!response.ok) throw new Error(response.status === 404 ? 'Эта задача не найдена.' : 'Не удалось загрузить задачу.');
        const data: Job = await response.json();
        if (stopped) return;
        setJob(data); setError('');
        if (data.status === 'Done' && !results) { router.replace(`/results/${id}`); return; }
        if (data.status !== 'Done' && data.status !== 'Failed') timer = setTimeout(poll, 1200);
      } catch (caught) {
        if (!stopped) { setError(caught instanceof Error ? caught.message : 'Ошибка соединения.'); timer = setTimeout(poll, 4000); }
      }
    }
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [id, results, router]);

  if (!job) return <div className="page empty"><LoaderCircle className="spin mx-auto text-[#c3f36b]"/><p role="status">{error || 'Загружаем задачу…'}</p><Link href="/dashboard" className="back">В личный кабинет</Link></div>;
  if (job.status === 'Failed') return <div className="page"><h1>Не удалось обработать видео</h1><p className="notice error" role="alert">{job.error}</p><p className="page-desc">Проверьте, что файл воспроизводится и имеет формат MP4, MOV или WebM.</p><Link href="/upload" className="primary">Выбрать другое видео</Link></div>;
  if (results && job.status === 'Done') return <div className="page">
    <Link className="back" href="/dashboard"><ArrowLeft size={14}/> В личный кабинет</Link>
    <div className="step-nav"><span>01 / Загрузка</span><span>02 / Обработка</span><span className="active">03 / Ваши клипы</span></div>
    <div className="eyebrow">НОВЫЕ МОМЕНТЫ</div><h1>Одно видео. Три свежих клипа.</h1><p className="page-desc">Фрагменты из «{job.filename}». Посмотрите и скачайте результат.</p>
    <div className="notice">Демонстрационный режим: заголовки и текст субтитров пока не основаны на реальной речи. Субтитры скачиваются отдельно и ещё не вшиты в видео.</div>
    <div className="results-grid">{job.clips.map((clip, index) => <article className="clip-card" key={clip.id}>
      <video className="clip-preview" controls preload="metadata" src={clip.url} aria-label={clip.title}/>
      <div className="clip-body"><div className="clip-meta"><span>КЛИП 0{index + 1}</span><span>{(clip.end - clip.start).toFixed(1)} СЕК</span></div><h3>{clip.title}</h3><p className="hook">«{clip.hook}»</p><p className="reason">{clip.reason}</p><div className="clip-actions"><a className="primary" href={`${clip.url}?download=1`} download><Download size={14}/> Скачать</a><button className="secondary" onClick={() => setEdit(clip.id)}>Редактировать позже</button></div><a className="sub-link" href={`/api/media/${id}/${clip.id}.srt?download=1`} download>↓ Скачать демо-субтитры (.srt)</a>{edit === clip.id && <p role="status" className="edit-note">Редактор клипов появится в следующей версии.</p>}</div>
    </article>)}</div>
  </div>;

  const active = steps.indexOf(job.status);
  return <div className="page"><div className="step-nav"><span>01 / Загрузка</span><span className="active">02 / Обработка</span><span>03 / Ваши клипы</span></div><h1>Скоро станет короче. И ярче.</h1><p className="page-desc">Готовим клипы из «{job.filename}». Эту страницу можно оставить открытой.</p>{error && <p className="notice error">{error} Повторяем попытку…</p>}<div className="processing-card"><div className="eyebrow"><LoaderCircle size={15} className="spin"/> СОЗДАЁМ КЛИПЫ</div><div className="progress-track"><div style={{width: `${Math.max(5, active / 6 * 100)}%`}}/></div><div aria-live="polite">{steps.map((step, index) => <div key={step} className={`processing-step ${index < active ? 'complete' : index === active ? 'current' : ''}`}><span className="step-circle">{index < active ? <Check size={14}/> : index === active ? <LoaderCircle size={14} className="spin"/> : index + 1}</span>{labels[step]}{index === active && <span className="ml-auto text-xs">В процессе</span>}</div>)}</div></div><p className="fine text-center">AI-этапы используют демонстрационные данные. Экспорт выполняется через FFmpeg и может занять несколько минут.</p></div>;
}
