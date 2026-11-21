'use client';
/**
 * "Amaliyot yozuvi": the whole session as it happened - who said what, in order, the student's
 * answers marked spoken or typed - with ONE player for the whole hearing (the transcript follows
 * the sound and any line can be clicked to jump there) and the downloads (PDF, Word, audio; xAPI
 * for teachers).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { attachVoices, buildAudio, download, fileName, printRecord, recordHtml, type BuiltAudio, type RecordAnalysis, type RecordLine, type RecordMeta } from '@/game/practiceRecord';
import { voicesOf, type VoiceClip } from '@/lib/voiceStore';

function Icon({ d }: { d: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}
const ICON = {
  pdf: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
  word: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M8.5 12l1.2 5 1.8-4 1.8 4 1.2-5',
  audio: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  play: 'M7 5v14l11-7z',
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function PracticeRecord({ meta, lines, analysis, scope, xapi }: {
  meta: RecordMeta;
  lines: RecordLine[];
  analysis: RecordAnalysis;
  /** Where the student's voice was kept (session id / case room). */
  scope: string;
  /** Teachers: the LMS statements (xAPI), downloaded as JSON. */
  xapi?: () => unknown;
}) {
  const [clips, setClips] = useState<VoiceClip[]>([]);
  useEffect(() => {
    let alive = true;
    void voicesOf(scope).then((c) => alive && setClips(c));
    return () => {
      alive = false;
    };
  }, [scope]);
  const matched = useMemo(() => attachVoices(lines, clips), [lines, clips]);
  const spoken = matched.map(Boolean);
  const answers = lines.filter((l) => l.role === 'student').length;

  // one player for the whole session, built on demand (it gathers every line's audio)
  const [built, setBuilt] = useState<(BuiltAudio & { url: string }) | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [failed, setFailed] = useState(false);
  const player = useRef<HTMLAudioElement>(null);
  const [active, setActive] = useState(-1);
  useEffect(() => () => void (built && URL.revokeObjectURL(built.url)), [built]);

  const build = async (thenPlay: boolean) => {
    if (progress) return null;
    setFailed(false);
    setProgress([0, lines.length]);
    try {
      const b = await buildAudio(lines, matched, (d, t) => setProgress([d, t]));
      const next = { ...b, url: URL.createObjectURL(b.wav) };
      setBuilt(next);
      if (thenPlay) requestAnimationFrame(() => void player.current?.play());
      return next;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setProgress(null);
    }
  };
  const seek = (i: number) => {
    const at = built?.marks[i];
    if (at === null || at === undefined || !player.current) return;
    player.current.currentTime = at;
    void player.current.play();
  };
  const onTime = () => {
    if (!built || !player.current) return;
    const t = player.current.currentTime + 0.05;
    let cur = -1;
    built.marks.forEach((m, i) => {
      if (m !== null && m <= t) cur = i;
    });
    setActive(cur);
  };
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (active < 0) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-line="${active}"]`);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [active]);

  const pdf = () => printRecord(recordHtml(meta, lines, spoken, analysis));
  const word = () => download(fileName(meta, 'doc'), '﻿' + recordHtml(meta, lines, spoken, analysis, true), 'application/msword');
  const audioFile = async () => {
    const b = built ?? (await build(false));
    if (b) download(fileName(meta, 'wav'), b.wav, 'audio/wav');
  };

  return (
    <section aria-labelledby="record-title" className="rounded-[24px] border border-black/[0.08] bg-white p-5 text-[#14171f] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="record-title" className="text-[1.15rem] font-semibold">Amaliyot yozuvi</h2>
          <p className="mt-0.5 text-[0.82rem] text-black/55 tabular-nums">
            {lines.filter((l) => l.role !== 'system').length} ta gap · {answers} ta javobingiz{spoken.some(Boolean) ? ` (${spoken.filter(Boolean).length} tasi ovozli)` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Yuklab olish">
          <button type="button" onClick={pdf} className="flex min-h-10 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[0.84rem] font-semibold transition-colors duration-150 hover:bg-black/[0.09]"><Icon d={ICON.pdf} />PDF</button>
          <button type="button" onClick={word} className="flex min-h-10 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[0.84rem] font-semibold transition-colors duration-150 hover:bg-black/[0.09]"><Icon d={ICON.word} />Word</button>
          <button type="button" onClick={() => void audioFile()} disabled={Boolean(progress)} className="flex min-h-10 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[0.84rem] font-semibold transition-colors duration-150 hover:bg-black/[0.09] disabled:opacity-50"><Icon d={ICON.audio} />Audio</button>
        </div>
      </div>

      {/* the whole session in one player */}
      <div className="mt-4 rounded-2xl bg-[#f3f2ee] p-3">
        {built ? (
          <audio ref={player} src={built.url} controls preload="auto" onTimeUpdate={onTime} onEnded={() => setActive(-1)} className="h-10 w-full" aria-label="Butun majlis yozuvi" />
        ) : (
          <button type="button" onClick={() => void build(true)} disabled={Boolean(progress)}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-black/[0.04] disabled:cursor-progress">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1f8a5b] text-white"><Icon d={ICON.play} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.92rem] font-semibold">{progress ? 'Ovozlar yigʻilmoqda…' : 'Butun majlisni tinglash'}</span>
              <span className="block text-[0.76rem] text-black/50">
                {progress ? `${progress[0]} / ${progress[1]}` : failed ? 'Ovozni yigʻib boʻlmadi - qayta urinib koʻring' : 'Sud va sizning ovozingiz bitta yozuvda; matn ovoz bilan birga yuradi'}
              </span>
            </span>
            {progress && (
              <span className="h-1 w-24 overflow-hidden rounded-full bg-black/10" aria-hidden>
                <span className="block h-full rounded-full bg-[#1f8a5b] transition-[width] duration-300" style={{ width: `${(progress[0] / Math.max(1, progress[1])) * 100}%` }} />
              </span>
            )}
          </button>
        )}
        {built && <p className="mt-1.5 px-1 text-[0.72rem] text-black/45 tabular-nums">{mmss(built.seconds)} · yozma javoblaringiz faqat matnda</p>}
      </div>

      <ol ref={list} className="scroll-soft mt-4 max-h-[30rem] space-y-1 overflow-y-auto pr-1" aria-label="Majlis yozuvi">
        {lines.map((l, i) => {
          const at = built?.marks[i];
          const can = at !== null && at !== undefined;
          const on = i === active;
          if (l.role === 'system') return <li key={i} data-line={i} className="px-3 py-1.5 text-center text-[0.78rem] text-black/45 italic">{l.text}</li>;
          const me = l.role === 'student';
          return (
            <li key={i} data-line={i} className={`flex ${me ? 'justify-end' : ''}`}>
              <button type="button" onClick={() => seek(i)} disabled={!can} aria-current={on ? 'true' : undefined}
                className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-left transition-[background-color,box-shadow] duration-200 disabled:cursor-default ${
                  me ? 'bg-[#e6f2ec]' : 'bg-black/[0.035]'} ${on ? 'ring-2 ring-[#1f8a5b]/60' : can ? 'hover:bg-black/[0.06]' : ''}`}>
                <span className={`flex items-center gap-2 text-[0.7rem] font-semibold tracking-wide uppercase ${me ? 'text-[#1f6b48]' : 'text-black/50'}`}>
                  {l.who}
                  {me && <span className="font-normal tracking-normal normal-case text-black/40">{spoken[i] ? 'ovozli' : 'yozma'}</span>}
                  {can && <span className="ml-auto font-normal tracking-normal text-black/35 tabular-nums">{mmss(at)}</span>}
                </span>
                <span className="mt-0.5 block text-[0.9rem] leading-snug">{l.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {xapi && (
        <p className="mt-3 text-right text-[0.74rem] text-black/45">
          Oʻqituvchilar uchun:{' '}
          <button type="button" className="font-semibold text-black/60 underline-offset-2 hover:underline" onClick={() => download(fileName(meta, 'xapi.json'), JSON.stringify(xapi(), null, 2), 'application/json')}>LMS (xAPI) maʼlumoti</button>
        </p>
      )}
    </section>
  );
}
