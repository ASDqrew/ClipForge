'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, ArrowLeft, ArrowRight, Film, LoaderCircle, X } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024 * 1024;
const fileSize = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} ГБ` : `${(bytes / 1024 ** 2).toFixed(1)} МБ`;

export default function UploadPage() {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!isPending && !session) router.replace('/login'); }, [isPending, session, router]);

  function choose(selected?: File) {
    setError('');
    if (!selected) return;
    if (!/\.(mp4|mov|webm)$/i.test(selected.name) || !selected.size) return setError('Выберите непустое видео MP4, MOV или WebM.');
    if (selected.size > MAX_UPLOAD_SIZE) return setError('Максимальный размер видео — 2 ГБ.');
    setFile(selected); setProgress(0);
  }

  function upload() {
    if (!file || !session) return;
    setBusy(true); setError('');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/jobs');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status !== 201) throw new Error(data.error);
        router.push(`/jobs/${data.id}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Не удалось загрузить видео.'); setBusy(false);
      }
    };
    xhr.onerror = () => { setError('Соединение прервалось. Попробуйте ещё раз.'); setBusy(false); };
    xhr.send(file);
  }

  if (isPending || !session) return <div className="page empty"><LoaderCircle className="spin mx-auto text-[#c3f36b]"/><p>Проверяем аккаунт…</p></div>;
  return <div className="page">
    <Link href="/dashboard" className="back"><ArrowLeft size={14}/> В личный кабинет</Link>
    <div className="step-nav"><span className="active">01 / Загрузка</span><span>02 / Обработка</span><span>03 / Ваши клипы</span></div>
    <h1>Хорошие клипы начинаются здесь.</h1>
    <p className="page-desc">Загрузите длинное видео — мы подготовим из него короткие фрагменты.</p>
    <div className="upload-panel">
      <input ref={input} type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(event) => choose(event.target.files?.[0])} disabled={busy}/>
      <button type="button" disabled={busy} className={`drop ${drag ? 'drag' : ''}`} onClick={() => input.current?.click()} onDragOver={(event) => {event.preventDefault(); setDrag(true);}} onDragLeave={() => setDrag(false)} onDrop={(event) => {event.preventDefault(); setDrag(false); if (!busy) choose(event.dataTransfer.files[0]);}}>
        <span className="upload-icon"><Upload size={30}/></span><strong>Перетащите видео сюда</strong><span className="text-sm text-[#c3f36b]">или нажмите, чтобы выбрать файл</span><small>MP4, MOV, WebM · До 2 ГБ</small>
      </button>
      {file && <div className="selected"><Film size={24} className="text-[#c3f36b]"/><div className="file-info"><strong>{file.name}</strong><small>{fileSize(file.size)}</small></div><button aria-label="Убрать выбранный файл" className="icon-button" disabled={busy} onClick={() => {setFile(null); if (input.current) input.current.value = '';}}><X size={18}/></button></div>}
      {busy && <div role="status"><div className="progress-track"><div style={{width: `${progress}%`}}/></div><p className="fine">{progress === 100 ? 'Видео загружено. Создаём задачу…' : `Загружаем видео… ${progress}%`}</p></div>}
      {error && <p role="alert" className="notice error">{error}</p>}
      <button className="primary wide" disabled={!file || busy} onClick={upload}>{busy ? 'Подождите…' : 'Создать клипы'}<ArrowRight size={17}/></button>
      <div className="notice">MVP-режим: видеофрагменты создаются из вашего файла с помощью FFmpeg. Расшифровка, заголовки и текст субтитров пока демонстрационные.</div>
      <p className="fine text-center">Файл загружается потоком и не помещается целиком в память.<br/>Данные хранятся локально на сервере и доступны только вашему аккаунту.</p>
    </div>
  </div>;
}
