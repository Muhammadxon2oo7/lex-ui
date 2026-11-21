'use client';
/**
 * One moot-court room, from the lobby to the decision.
 *
 * The server owns the truth (whose floor, the clock, who sees what); this page long-polls it and
 * shows the player THEIR seat: lobby → the case file → the hearing in the 3D hall → the verdict.
 * The court's lines are voiced by the server's actors; other people are heard in their own voice
 * (the clip each of them records with push-to-talk).
 */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MootAct, MootEntry, MootPlayer, MootRole, MootRoom, MootSide, Team } from '@/contracts/moot';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Talk } from '@/components/hud/Talk';
import { Drawer } from '@/components/ui/Drawer';
import { CaseMeta, Debrief, Norms, Timeline } from '@/components/moot/CaseParts';
import { modal, note } from '@/lib/motion';
import { PracticeRecord } from '@/components/record/PracticeRecord';
import { GlassLayer } from '@/components/ui/glass';
import { ApiError } from '@/game/api';
import { moot } from '@/game/moot';
import type { RecordLine } from '@/game/practiceRecord';
import { getProfile, saveProfile } from '@/game/profile';
import { dropVoice, playClip, speak, stopSpeaking, takeVoice } from '@/game/voice';
import { saveVoice } from '@/lib/voiceStore';
import type { Speaker } from '@/contracts/hearing';

const CourtRoom = dynamic(() => import('@/components/world/CourtRoom'), { ssr: false });

const SIDE: Record<MootSide, string> = { claimant: 'Daʼvogar tomoni', respondent: 'Javobgar tomoni' };
const ROLE: Record<MootRole, [string, string]> = {
  lead: ['Bosh vakil', 'Pozitsiyani bayon qilasiz, muzokara va replikada soʻzga chiqasiz.'],
  second: ['Ikkinchi vakil', 'Raqibga savol berasiz va dalillarni koʻrsatasiz.'],
  party: ['Taraf', 'Raqibning savollariga javob berasiz.'],
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ───────────────────────── the live room ───────────────────────── */

function useRoom(code: string) {
  const [room, setRoom] = useState<MootRoom | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [retry, setRetry] = useState(0);
  /** server clock − ours */
  const [skew, setSkew] = useState(0);
  const take = useCallback((r: MootRoom) => {
    setSkew(r.now - Date.now());
    setRoom((old) => (old && old.version > r.version ? old : r));
  }, []);

  useEffect(() => {
    const stop = new AbortController();
    let version: number | null = null;
    void (async () => {
      let failures = 0;
      while (!stop.signal.aborted) {
        try {
          const r = await moot.read(code, version, stop.signal);
          version = r.version;
          failures = 0;
          setError(null);
          take(r);
        } catch (e) {
          if (stop.signal.aborted) return;
          const err = e instanceof ApiError ? e : new ApiError(0, 'network', 'Aloqa uzildi');
          // not a member yet (opened by link): join with the saved name, once
          if (err.code === 'not_in_room') {
            const p = getProfile();
            if (p?.name && failures === 0) {
              failures += 1;
              try {
                take(await moot.join(code, p.name, p.avatar));
                continue;
              } catch (j) {
                return void setError(j instanceof ApiError ? j : err);
              }
            }
            return void setError(err);
          }
          if (err.status === 404) return void setError(err);
          failures += 1;
          if (failures > 2) setError(err);
          await wait(Math.min(6000, 800 * failures));
        }
      }
    })();
    return () => stop.abort();
  }, [code, take, retry]);

  const act = useCallback(async (a: MootAct) => take(await moot.act(code, a)), [code, take]);
  return { room, error, act, take, skew, rejoin: () => { setError(null); setRetry((n) => n + 1); } };
}

/** Seconds left on the server's clock (null when no clock runs). */
function useLeft(room: MootRoom, skew: number) {
  const [now, setNow] = useState(room.now - skew);
  useEffect(() => {
    if (!room.endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [room.endsAt]);
  return room.endsAt ? Math.max(0, Math.ceil((room.endsAt - (now + skew)) / 1000)) : null;
}

/* ───────────────────────── small pieces ───────────────────────── */

function Notice({ text, onClose }: { text: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [text, onClose]);
  if (!text) return null;
  return <p role="alert" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-2xl bg-[#1d1d1f] px-4 py-3 text-center text-[0.9rem] font-medium text-white shadow-xl">{text}</p>;
}

function PlayerRow({ p, me, tag }: { p: MootPlayer; me: boolean; tag?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-paper px-3 py-2.5">
      <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-full text-[0.85rem] font-bold ${p.online ? 'bg-accent-soft text-accent-ink' : 'bg-line text-ink-3'}`}>{p.name.trim()[0]?.toUpperCase()}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.95rem] font-semibold">{p.name}{me && <span className="font-normal text-ink-3"> · siz</span>}</span>
        <span className="block text-[0.76rem] text-ink-3">{[p.host ? 'xona egasi' : null, tag, p.online ? null : 'aloqada yoʻq'].filter(Boolean).join(' · ') || ' '}</span>
      </span>
      {(p.ready || p.host) && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[0.72rem] font-semibold text-accent-ink">{p.host && !p.ready ? 'Boshlovchi' : 'Tayyor'}</span>}
    </li>
  );
}

function CaseFile({ room, dark = false }: { room: MootRoom; dark?: boolean }) {
  const c = room.case;
  const box = dark ? 'rounded-2xl bg-white/8 p-4' : 'surface rounded-[20px] p-4';
  const dim = dark ? 'text-white/65' : 'text-ink-2';
  const h = `text-[0.74rem] font-semibold tracking-wider uppercase ${dark ? 'text-white/55' : 'text-ink-3'}`;
  return (
    <div className="space-y-3 text-[0.92rem] leading-relaxed">
      <div className={box}>
        <p className={h}>Ish</p>
        <p className="mt-1 font-semibold">{c.title}</p>
        <div className="mt-0.5 mb-1"><CaseMeta c={c} dark={dark} /></div>
        <p className={dim}>{c.summary}</p>
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
          <dt className={dim}>Daʼvogar</dt><dd>{c.parties.claimant}</dd>
          <dt className={dim}>Javobgar</dt><dd>{c.parties.respondent}</dd>
          <dt className={dim}>Talab</dt><dd>{c.claim}</dd>
        </dl>
      </div>
      {c.confidential.length > 0 && (
        <div className={`rounded-2xl p-4 ${dark ? 'bg-amber-400/12 ring-1 ring-amber-300/30' : 'bg-[#fff7e6] ring-1 ring-[#f0d9a8]'}`}>
          <p className={`text-[0.74rem] font-semibold tracking-wider uppercase ${dark ? 'text-amber-200' : 'text-[#8a5a00]'}`}>Faqat sizning jamoangiz biladi</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">{c.confidential.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      {c.task.length > 0 && (
        <div className={box}>
          <p className={h}>Vazifangiz</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">{c.task.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      <div className={box}>
        <p className={h}>Holatlar</p>
        <ul className="mt-1.5 space-y-2">{c.facts.map((f) => <li key={f.id}><span className="font-semibold">{f.title}. </span><span className={dim}>{f.text}</span></li>)}</ul>
      </div>
      {c.timeline.length > 0 && (
        <div className={box}>
          <p className={h}>Sanalar zanjiri</p>
          <Timeline items={c.timeline} dark={dark} />
        </div>
      )}
      <div className={box}>
        <p className={h}>Ish materiallaridagi dalillar</p>
        <ul className="mt-1.5 space-y-2">{c.evidence.map((f) => <li key={f.id}><span className="font-semibold">{f.title}. </span><span className={dim}>{f.text}</span></li>)}</ul>
      </div>
      {c.norms.length > 0 && (
        <div className={box}>
          <p className={h}>Normalar · lex.uz</p>
          <p className={`mt-1 text-[0.8rem] ${dim}`}>Ishga tegishli boʻlishi mumkin boʻlgan moddalar va Plenum bandlari. Qaysi biri kimga foydali - oʻzingiz aniqlaysiz.</p>
          <Norms items={c.norms} dark={dark} />
        </div>
      )}
      <p className={`text-[0.78rem] ${dark ? 'text-white/45' : 'text-ink-3'}`}>{c.disclaimer}</p>
    </div>
  );
}

function TeamChat({ room, act, dark = false }: { room: MootRoom; act: (a: MootAct) => Promise<void>; dark?: boolean }) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [room.chat.length]);
  if (!room.me.team) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className={`text-[0.78rem] ${dark ? 'text-white/55' : 'text-ink-3'}`}>Faqat jamoangiz koʻradi. Raqib ham, sudya ham oʻqimaydi.</p>
      <ul className="mt-2 min-h-24 flex-1 space-y-1.5 overflow-y-auto" aria-live="polite">
        {room.chat.length === 0 && <li className={`text-[0.88rem] ${dark ? 'text-white/45' : 'text-ink-3'}`}>Hali xabar yoʻq. Strategiyani shu yerda kelishing.</li>}
        {room.chat.map((m) => (
          <li key={m.id} className={`w-fit max-w-[88%] rounded-2xl px-3 py-1.5 text-[0.9rem] ${m.by === room.me.id ? 'ml-auto bg-accent text-white' : dark ? 'bg-white/10' : 'bg-paper'}`}>
            {m.by !== room.me.id && <span className={`block text-[0.72rem] font-semibold ${dark ? 'text-white/60' : 'text-ink-3'}`}>{m.name}</span>}
            {m.text}
          </li>
        ))}
        <div ref={end} />
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (!t) return; setText(''); void act({ type: 'chat', text: t }).catch(() => setText(t)); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="Jamoaga yozing…" aria-label="Jamoa chatiga xabar"
          className={dark ? 'min-h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[0.95rem] text-white outline-none placeholder:text-white/40 focus:bg-white/15' : 'field min-w-0 flex-1'} />
        <button type="submit" disabled={!text.trim()} className={dark ? 'min-h-11 rounded-full bg-white px-4 text-[0.88rem] font-semibold text-[#0c0f14] disabled:opacity-40' : 'btn btn-primary'}>Yuborish</button>
      </form>
    </div>
  );
}

/* ───────────────────────── lobby ───────────────────────── */

function Lobby({ room, act, say }: { room: MootRoom; act: (a: MootAct) => Promise<void>; say: (t: string) => void }) {
  const me = room.players.find((p) => p.id === room.me.id)!;
  const [copied, setCopied] = useState(false);
  const run = (a: MootAct) => void act(a).catch((e) => say(e instanceof ApiError ? e.message : 'Xatolik yuz berdi'));
  const share = async () => {
    const url = `${location.origin}/bahs/${room.code}`;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'LexSim - Bahs', text: `Sud bahsiga qoʻshiling. Xona kodi: ${room.code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };
  const full = room.players.length >= room.size * 2;
  const others = room.players.filter((p) => !p.host);
  const blocked = room.players.length < 2 ? 'Kamida yana bir kishi kerak' : room.assign === 'pick' && (['A', 'B'] as Team[]).some((t) => !room.players.some((p) => p.team === t)) ? 'Har ikki jamoada kamida bir kishi boʻlsin' : room.assign === 'pick' && room.players.some((p) => !p.team) ? 'Hamma jamoa tanlashi kerak' : others.some((p) => !p.ready) ? 'Hamma «Tayyorman» deyishini kuting' : null;
  const team = (t: Team) => {
    const list = room.players.filter((p) => p.team === t);
    const mine = me.team === t;
    return (
      <section key={t} aria-label={`${t} jamoa`} className={`surface rounded-[28px] p-4 ${mine ? 'ring-2 ring-accent' : ''}`}>
        <div className="flex items-center justify-between">
          <h2 className="display text-lg font-semibold">{t} jamoa</h2>
          <span className="text-[0.8rem] text-ink-3">{list.length} / {room.size}</span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {list.map((p) => <PlayerRow key={p.id} p={p} me={p.id === me.id} />)}
          {Array.from({ length: Math.max(0, room.size - list.length) }, (_, i) => <li key={i} className="rounded-2xl border border-dashed border-line px-3 py-3.5 text-[0.86rem] text-ink-3">Boʻsh oʻrin</li>)}
        </ul>
        {!mine && list.length < room.size && <button type="button" className="btn btn-quiet mt-3 w-full" onClick={() => run({ type: 'team', team: t })}>{t} jamoaga oʻtish</button>}
      </section>
    );
  };
  return (
    <main className="relative isolate mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:py-12">
      <GlassLayer />
      <Link href="/bahs" className="text-[0.85rem] font-semibold text-accent-ink" onClick={() => void moot.act(room.code, { type: 'leave' }).catch(() => {})}>← Xonadan chiqish</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.78rem] font-semibold tracking-wider text-accent-ink uppercase">Xona kodi</p>
          <p className="display font-mono text-[clamp(2.4rem,8vw,3.6rem)] leading-none font-semibold tracking-[0.18em]" aria-label={`Xona kodi ${room.code.split('').join(' ')}`}>{room.code}</p>
        </div>
        <button type="button" className="btn btn-dark" onClick={() => void share()}>{copied ? 'Havola nusxalandi' : 'Havolani ulashish'}</button>
      </div>
      <p className="mt-3 text-[0.95rem] text-ink-2" role="status">
        {full ? 'Xona toʻldi.' : `Doʻstlaringizga kodni yuboring: ${room.players.length} / ${room.size * 2} kishi.`} Ish: <span className="font-semibold text-ink">{room.case.title}</span>. Tomon (daʼvogar yoki javobgar) va rol boshlanganda qurʼa bilan tushadi.
      </p>

      {room.assign === 'pick' ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">{(['A', 'B'] as Team[]).map(team)}</div>
      ) : (
        <section aria-label="Ishtirokchilar" className="mt-6 surface rounded-[28px] p-4">
          <div className="flex items-center justify-between">
            <h2 className="display text-lg font-semibold">Ishtirokchilar</h2>
            <span className="text-[0.8rem] text-ink-3">Jamoalar qurʼa bilan · {room.players.length} / {room.size * 2}</span>
          </div>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">{room.players.map((p) => <PlayerRow key={p.id} p={p} me={p.id === me.id} />)}</ul>
        </section>
      )}

      {me.host && (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 surface rounded-[28px] p-4">
          <fieldset>
            <legend className="text-[0.8rem] font-semibold text-ink-2">Jamoa hajmi</legend>
            <div className="mt-1.5 flex gap-1 rounded-2xl bg-paper p-1" role="radiogroup">
              {[1, 2, 3].map((n) => <button key={n} type="button" role="radio" aria-checked={room.size === n} disabled={room.players.length > n * 2} onClick={() => run({ type: 'settings', size: n })} className={`min-h-10 rounded-xl px-4 text-[0.88rem] font-semibold disabled:opacity-35 ${room.size === n ? 'bg-card shadow-sm' : 'text-ink-3'}`}>{n} ga {n}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-[0.8rem] font-semibold text-ink-2">Jamoalar</legend>
            <div className="mt-1.5 flex gap-1 rounded-2xl bg-paper p-1" role="radiogroup">
              {([['pick', 'Oʻzimiz tanlaymiz'], ['random', 'Qurʼa bilan']] as const).map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={room.assign === id} onClick={() => run({ type: 'settings', assign: id })} className={`min-h-10 rounded-xl px-4 text-[0.88rem] font-semibold ${room.assign === id ? 'bg-card shadow-sm' : 'text-ink-3'}`}>{label}</button>)}
            </div>
          </fieldset>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {me.host ? (
          <button type="button" className="btn btn-primary min-w-52 max-sm:w-full" disabled={Boolean(blocked)} onClick={() => run({ type: 'start' })}>Qurʼa tashlash va boshlash</button>
        ) : (
          <button type="button" className={`btn min-w-52 max-sm:w-full ${me.ready ? 'btn-quiet' : 'btn-primary'}`} onClick={() => run({ type: 'ready', ready: !me.ready })}>{me.ready ? 'Tayyor emasman' : 'Tayyorman'}</button>
        )}
        <p className="text-[0.86rem] text-ink-3" role="status">{me.host ? (blocked ?? 'Hamma tayyor. Boshlashingiz mumkin.') : me.ready ? 'Xona egasi boshlashini kuting.' : 'Mikrofoningiz ishlashini tekshirib, «Tayyorman» ni bosing.'}</p>
      </div>
    </main>
  );
}

/* ───────────────────────── briefing ───────────────────────── */

function Briefing({ room, act, say, skew }: { room: MootRoom; act: (a: MootAct) => Promise<void>; say: (t: string) => void; skew: number }) {
  const left = useLeft(room, skew);
  const me = room.players.find((p) => p.id === room.me.id)!;
  const side = room.me.side!;
  const mates = room.players.filter((p) => p.team === room.me.team);
  const foes = room.players.filter((p) => p.team && p.team !== room.me.team);
  const role = room.me.role ?? 'lead';
  const floors = room.agenda.filter((s) => s.kind === 'speech' && s.side === side && (s.role === role || !mates.some((p) => p.role === s.role)));
  return (
    <main className="relative isolate mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:py-12">
      <GlassLayer />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.78rem] font-semibold tracking-wider text-accent-ink uppercase">Qurʼa natijasi · {room.me.team} jamoa</p>
          <h1 className="display mt-1 text-[clamp(1.8rem,5vw,2.8rem)] font-semibold text-balance">Siz - {SIDE[side].toLowerCase()}, {ROLE[role][0].toLowerCase()}</h1>
          <p className="mt-1 text-[0.98rem] text-ink-2">{ROLE[role][1]} Majlisda tayyor javob yoʻq - ish papkasini oʻqing va jamoangiz bilan kelishing.</p>
        </div>
        <div className="rounded-2xl bg-card px-4 py-2 text-center ring-1 ring-line" role="timer" aria-label="Majlis boshlanishiga qolgan vaqt">
          <p className="text-[0.72rem] font-semibold tracking-wider text-ink-3 uppercase">Majlisgacha</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">{left === null ? '-' : mmss(left)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <CaseFile room={room} />
        <div className="space-y-4">
          <section className="surface rounded-[28px] p-4">
            <h2 className="text-[0.74rem] font-semibold tracking-wider text-ink-3 uppercase">Jamoangiz · {SIDE[side]}</h2>
            <ul className="mt-2 space-y-1.5">{mates.map((p) => <PlayerRow key={p.id} p={p} me={p.id === me.id} tag={p.role ? ROLE[p.role][0] : undefined} />)}</ul>
            <h2 className="mt-4 text-[0.74rem] font-semibold tracking-wider text-ink-3 uppercase">Raqib · {SIDE[side === 'claimant' ? 'respondent' : 'claimant']}</h2>
            <ul className="mt-2 space-y-1.5">{foes.map((p) => <PlayerRow key={p.id} p={p} me={false} tag={p.role ? ROLE[p.role][0] : undefined} />)}</ul>
          </section>
          <section className="surface rounded-[28px] p-4">
            <h2 className="text-[0.74rem] font-semibold tracking-wider text-ink-3 uppercase">Sizga soʻz beriladi</h2>
            <ol className="mt-2 space-y-1.5 text-[0.92rem]">
              {floors.map((s) => <li key={s.id} className="flex justify-between gap-3"><span>{s.title}</span><span className="shrink-0 font-mono text-ink-3 tabular-nums">{mmss(s.seconds)}</span></li>)}
            </ol>
            <p className="mt-2 text-[0.8rem] text-ink-3">Sudga «Hurmatli sud!» deb murojaat qiling. Soʻz sizda boʻlganda T tugmasini bosib turib gapirasiz.</p>
          </section>
          {mates.length > 1 && (
            <section className="flex max-h-80 flex-col surface rounded-[28px] p-4">
              <h2 className="mb-1 text-[0.74rem] font-semibold tracking-wider text-ink-3 uppercase">Jamoa chati</h2>
              <TeamChat room={room} act={act} />
            </section>
          )}
          <button type="button" className={`btn w-full ${me.ready ? 'btn-quiet' : 'btn-primary'}`} onClick={() => void act({ type: 'ready', ready: !me.ready }).catch((e) => say(e instanceof ApiError ? e.message : 'Xatolik'))}>
            {me.ready ? 'Tayyorman ✓ - boshqalar kutilmoqda' : 'Oʻqib boʻldim, tayyorman'}
          </button>
          <p className="text-center text-[0.8rem] text-ink-3">{room.players.filter((p) => p.ready).length} / {room.players.length} kishi tayyor. Hamma tayyor boʻlsa, majlis darhol boshlanadi.</p>
        </div>
      </div>
    </main>
  );
}

/* ───────────────────────── hearing ───────────────────────── */

/**
 * Plays the record in order, one voice at a time: the court's lines through the server's actors,
 * other people's lines in their own recorded voice. Your own lines are not played back to you.
 */
function usePresenter(room: MootRoom, muted: boolean) {
  const [current, setCurrent] = useState<MootEntry | null>(null);
  const [done, setDone] = useState(0);
  const state = useRef({ next: -1, busy: false, alive: true, list: room.transcript, me: room.me.id, code: room.code, muted });
  useEffect(() => {
    state.current.list = room.transcript;
    state.current.muted = muted;
  });
  useEffect(() => {
    const s = state.current;
    s.alive = true;
    return () => {
      s.alive = false;
      stopSpeaking();
    };
  }, []);
  useEffect(() => {
    const s = state.current;
    // arriving late (a reload): do not replay the whole hearing, only what was just said
    if (s.next < 0) {
      const fresh = room.transcript.findIndex((e) => room.now - e.at < 9000);
      s.next = fresh < 0 ? room.transcript.length : fresh;
      setDone(s.next);
    }
    if (s.busy) return;
    s.busy = true;
    void (async () => {
      while (s.alive && s.next < s.list.length) {
        const e = s.list[s.next];
        const behind = s.list.length - s.next - 1;
        if (e.by !== s.me && e.by !== 'system') {
          setCurrent(e);
          const court = e.by === 'judge' || e.by === 'secretary';
          // far behind the room: show the words, skip the sound, catch up
          const late = behind >= 3 && !court;
          let played = false;
          if (!s.muted && !late) {
            if (court) played = await speak(e.text, e.by === 'judge' ? 'elder_m' : 'female');
            else if (e.audio) {
              const clip = await moot.clip(s.code, e.audio);
              if (clip && s.alive) played = await playClip(clip, e.text);
            }
          }
          if (!played) await wait(late ? 900 : Math.min(7000, 1200 + e.text.length * 45));
          await wait(court ? 350 : 250);
        } else if (e.by === 'system') {
          setCurrent(e);
          await wait(2200);
        }
        s.next += 1;
        setDone(s.next);
      }
      setCurrent(null);
      s.busy = false;
    })();
  }, [room.transcript.length, room.transcript, room.now]);
  return { current, caughtUp: done >= room.transcript.length };
}

function Hearing({ room, act, say, skew, onVerdict }: { room: MootRoom; act: (a: MootAct) => Promise<void>; say: (t: string) => void; skew: number; onVerdict: () => void }) {
  const left = useLeft(room, skew);
  const [muted, setMuted] = useState(false);
  const { current, caughtUp } = usePresenter(room, muted);
  const [panel, setPanel] = useState<'file' | 'chat' | 'record' | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [seenChat, setSeenChat] = useState(room.chat.length);
  const open = (id: typeof panel) => {
    setSeenChat(room.chat.length);
    setPanel(id);
  };

  const me = room.players.find((p) => p.id === room.me.id)!;
  const side = room.me.side!;
  const step = room.agenda[room.step];
  const mine = room.speaker === me.id;
  const speaker = room.players.find((p) => p.id === room.speaker) ?? null;
  const mates = room.players.filter((p) => p.team === me.team && p.id !== me.id);
  const foes = room.players.filter((p) => p.team && p.team !== me.team);
  const deciding = room.phase === 'hearing' && step?.id === 'retire' && !room.endsAt;
  const over = room.phase === 'verdict';
  useEffect(() => {
    if (over && caughtUp) onVerdict();
  }, [over, caughtUp, onVerdict]);

  // who is heard right now → which body in the hall speaks
  const by = current?.by ?? null;
  const seat: Speaker | null = by === 'judge' ? 'judge' : by === 'secretary' ? 'secretary' : by && by === mates[0]?.id ? 'claimant' : by && by === foes[0]?.id ? 'respondent' : null;
  const opening = room.phase === 'hearing' && step?.id === 'open';
  const rising = (opening && current?.by === 'secretary') || (over && current?.by === 'secretary');
  const myWords = useMemo(() => room.transcript.filter((e) => e.by === me.id && e.step === step?.id), [room.transcript, me.id, step?.id]);
  const companions = useMemo(
    () => [...mates.slice(1).map((p) => ({ id: p.id, model: p.avatar, side: 'left' as const, talking: by === p.id })), ...foes.slice(1).map((p) => ({ id: p.id, model: p.avatar, side: 'right' as const, talking: by === p.id }))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.players, by],
  );

  const send = async (text: string, voiced: boolean) => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const wav = voiced ? takeVoice() : (dropVoice(), null);
      let audio: string | undefined;
      if (wav) {
        void saveVoice(`moot:${room.code}`, t, wav.slice(0)).catch(() => {});
        audio = (await moot.audio(room.code, wav)) ?? undefined;
      }
      await act({ type: 'say', text: t.slice(0, 1200), ...(audio ? { audio } : {}) });
      if (!voiced) setDraft('');
    } catch (e) {
      say(e instanceof ApiError ? e.message : 'Yuborib boʻlmadi');
    } finally {
      setSending(false);
    }
  };

  const urgent = mine && left !== null && left <= 10;
  const caption = current && current.by !== 'system' ? current : null;
  const labels = side === 'claimant' ? { left: 'DAʼVOGAR', right: 'JAVOBGAR' } : { left: 'JAVOBGAR', right: 'DAʼVOGAR' };
  const status = deciding ? 'Sud maslahatxonada. Qaror tayyorlanmoqda…' : over ? 'Sud qarorni oʻqib eshittirmoqda' : mine ? 'Soʻz sizda' : speaker ? `Soʻz: ${speaker.name} (${speaker.team === me.team ? 'jamoadoshingiz' : 'raqib'})` : (step?.title ?? '');

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0c0f14] text-white select-none">
      <div className="absolute inset-0">
        <CourtRoom
          view="advocate"
          speaker={seat}
          witnessPresent={false}
          witnessCalled={false}
          standing={rising ? ['secretary', 'claimant', 'respondent'] : []}
          judgePresent={!deciding && !(opening && current?.by === 'secretary' && room.transcript.length < 2)}
          judgeEntries={over ? 2 : 1}
          advocateStanding={mine || rising}
          advocateSpeaking={mine && sending}
          attention={mine && !sending && caughtUp ? 'waiting' : null}
          avatar={me.avatar}
          labels={labels}
          cast={{ principal: mates[0] ? mates[0].avatar : null, opponent: foes[0]?.avatar ?? 'man' }}
          companions={companions}
          screen={[room.case.court, room.case.title, step?.title ?? '']}
        />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[42dvh] bg-gradient-to-t from-black/70 to-transparent" />

      {/* top bar: where the hearing is, whose floor, the clock */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3 sm:p-4">
        <div className="glass flex min-w-0 items-center gap-2 rounded-full py-1 pr-1 pl-1 sm:pr-4">
          <span className="grid h-9 shrink-0 place-items-center rounded-full bg-white px-3 text-[0.8rem] font-semibold text-[#0c0f14]"><span className="max-sm:hidden">Bahs · {room.code}</span><span className="sm:hidden">{room.step + 1}/{room.agenda.length}</span></span>
          <span className="truncate text-[0.84rem] text-white/80 max-sm:hidden">{step ? `${room.step + 1}/${room.agenda.length} · ${step.title}` : room.case.title}</span>
        </div>
        <div className="glass ml-auto flex shrink-0 items-center gap-1 rounded-full p-1">
          {([['file', 'Ish papkasi', 'Papka'], ['chat', 'Jamoa', 'Jamoa'], ['record', 'Bayonnoma', 'Bayon'] ] as const).filter(([id]) => id !== 'chat' || mates.length > 0).map(([id, label, short]) => (
            <button key={id} type="button" aria-pressed={panel === id} onClick={() => open(panel === id ? null : id)}
              className={`relative min-h-9 rounded-full px-3 text-[0.82rem] font-semibold transition-colors duration-150 ${panel === id ? 'bg-white text-[#0c0f14]' : 'text-white/85 hover:bg-white/12'}`}>
              <span className="max-sm:hidden">{label}</span><span className="sm:hidden">{short}</span>
              {id === 'chat' && panel !== 'chat' && room.chat.length > seenChat && <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-emerald-400 text-[0.62rem] font-bold text-[#0c0f14]">{room.chat.length - seenChat}</span>}
            </button>
          ))}
          <button type="button" aria-pressed={muted} aria-label={muted ? 'Ovozni yoqish' : 'Ovozni oʻchirish'} title={muted ? 'Ovozni yoqish' : 'Ovozni oʻchirish'} onClick={() => { if (!muted) stopSpeaking(); setMuted(!muted); }}
            className="grid size-9 place-items-center rounded-full text-white/85 hover:bg-white/12">{muted ? '🔇' : '🔊'}</button>
        </div>
      </header>

      {/* the floor: who speaks, how long is left */}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-3 sm:top-20">
        <div className={`glass flex items-center gap-3 rounded-full py-1.5 pr-2 pl-4 transition-colors duration-300 ${mine ? '!border-emerald-300/50 !bg-emerald-600/85' : ''}`} role="status" aria-live="polite">
          <span className="text-[0.9rem] font-semibold">{status}</span>
          {left !== null && room.phase === 'hearing' && step?.kind === 'speech' && (
            <span role="timer" className={`rounded-full px-2.5 py-1 font-mono text-[0.9rem] font-semibold tabular-nums ${urgent ? 'bg-red-500 text-white' : 'bg-black/30'}`}>{mmss(left)}</span>
          )}
        </div>
      </div>

      {/* side panel */}
      <AnimatePresence>
        {panel && (
          <Drawer key="panel" side="right" label={panel === 'file' ? 'Ish papkasi' : panel === 'chat' ? 'Jamoa chati' : 'Bayonnoma'} onClose={() => open(null)} top="top-16 sm:top-20" z="z-30"
            className="glass w-[min(26rem,calc(100vw-1.5rem))] rounded-[24px] p-4 sm:right-4"
            header={
              <div className="mb-3 flex items-center justify-between">
                <h2 className="display text-lg font-semibold">{panel === 'file' ? 'Ish papkasi' : panel === 'chat' ? 'Jamoa chati' : 'Majlis bayonnomasi'}</h2>
                <button type="button" onClick={() => open(null)} aria-label="Yopish" className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/12">✕</button>
              </div>
            }>
          {panel === 'file' && <div className="min-h-0 flex-1 overflow-y-auto pr-1"><CaseFile room={room} dark /></div>}
          {panel === 'chat' && <TeamChat room={room} act={act} dark />}
          {panel === 'record' && (
            <ol className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 text-[0.9rem] leading-relaxed">
              {room.transcript.map((e) => e.by === 'system' ? <li key={e.id} className="text-[0.8rem] text-white/50">{e.text}</li> : (
                <li key={e.id}>
                  <span className={`text-[0.74rem] font-semibold ${e.side ? (e.side === side ? 'text-emerald-300' : 'text-amber-200') : 'text-white/55'}`}>{e.name}{e.side ? ` · ${SIDE[e.side].toLowerCase()}` : ''}</span>
                  <p>{e.text}</p>
                </li>
              ))}
            </ol>
          )}
          </Drawer>
        )}
      </AnimatePresence>

      {/* bottom: what is being said, and your floor */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 p-3 sm:p-5">
        <AnimatePresence mode="popLayout" initial={false}>
        {caption && (!mine || !caughtUp) && (
          <motion.div key={caption.id} {...note} layout="position" className="glass w-full max-w-2xl rounded-[22px] px-4 py-3 select-text" aria-live="polite">
            <p className="text-[0.74rem] font-semibold tracking-wide text-white/60 uppercase">{caption.name}{caption.side ? ` · ${SIDE[caption.side].toLowerCase()}` : ''}</p>
            <p className="mt-0.5 text-[1.02rem] leading-relaxed text-pretty">{caption.text}</p>
          </motion.div>
        )}
        </AnimatePresence>
        {deciding && <p className="glass rounded-full px-4 py-2 text-[0.9rem]" role="status">Sudya chiqishlarni baholamoqda…</p>}
        <AnimatePresence>
        {mine && !over && (
          <motion.div key="floor" {...modal} className="glass w-full max-w-2xl rounded-[24px] p-3">
            {myWords.length > 0 && (
              <ul className="mb-2 max-h-24 space-y-1 overflow-y-auto text-[0.9rem] text-white/75 select-text" aria-label="Aytganlaringiz">
                {myWords.map((e) => <li key={e.id}>- {e.text}</li>)}
              </ul>
            )}
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(draft, false); }}>
              <Talk compact enabled={!sending} onHeard={(t) => void send(t, true)} onError={say} />
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1200} placeholder="T ni bosib turib gapiring yoki yozing…" aria-label="Chiqishingiz matni"
                className="min-h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[0.95rem] text-white outline-none placeholder:text-white/45 focus:bg-white/15" />
              {draft.trim() ? (
                <button type="submit" disabled={sending} className="min-h-11 shrink-0 rounded-full bg-white px-4 text-[0.88rem] font-semibold text-[#0c0f14] disabled:opacity-50">Aytish</button>
              ) : (
                <button type="button" disabled={sending} onClick={() => void act({ type: 'yield' }).catch((e) => say(e instanceof ApiError ? e.message : 'Xatolik'))}
                  className="min-h-11 shrink-0 rounded-full bg-emerald-500 px-4 text-[0.88rem] font-semibold text-white hover:bg-emerald-400 disabled:opacity-50">{myWords.length ? 'Soʻzimni tugatdim' : 'Soʻzdan voz kechaman'}</button>
              )}
            </form>
            <p className="mt-2 px-1 text-[0.78rem] text-white/55">{sending ? 'Yuborilmoqda…' : 'Bir necha marta gapirishingiz mumkin. «Hurmatli sud!» deb boshlang. Vaqt tugasa, soʻz oʻzi oʻtadi.'}</p>
          </motion.div>
        )}
        </AnimatePresence>
        {over && !caughtUp && <button type="button" onClick={() => { stopSpeaking(); onVerdict(); }} className="glass min-h-11 rounded-full px-5 text-[0.9rem] font-semibold">Natijaga oʻtish</button>}
      </div>
    </main>
  );
}

/* ───────────────────────── verdict ───────────────────────── */

function Verdict({ room }: { room: MootRoom }) {
  const v = room.verdict!;
  const side = room.me.side;
  const won = v.winner && side ? v.winner === side : null;
  const lines: RecordLine[] = useMemo(
    () => room.transcript.filter((e) => e.by !== 'system').map((e) => ({
      who: e.side ? `${e.name} (${SIDE[e.side].toLowerCase()})` : e.name,
      role: e.by === room.me.id ? 'student' : e.by === 'judge' || e.by === 'secretary' ? 'npc' : 'system',
      text: e.text,
      ...(e.by === 'judge' ? { voice: 'elder_m' } : e.by === 'secretary' ? { voice: 'female' } : {}),
    })),
    [room.transcript, room.me.id],
  );
  const mine = v.players.find((p) => p.id === room.me.id);
  return (
    <main className="relative isolate mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:py-12">
      <GlassLayer />
      <p className="text-[0.78rem] font-semibold tracking-wider text-accent-ink uppercase">Bahs yakuni · {room.case.title}</p>
      <h1 className="display mt-1 text-[clamp(2rem,6vw,3.2rem)] font-semibold text-balance">
        {v.winner === null ? 'Durang' : won === null ? `${SIDE[v.winner]} ustun keldi` : won ? 'Jamoangiz ustun keldi' : 'Bu safar raqib ustun keldi'}
      </h1>
      <p className="mt-2 max-w-[62ch] text-[0.98rem] leading-relaxed text-ink-2">{v.ruling.join(' ')}</p>
      {v.pending && (
        <p role="status" className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1.5 text-[0.86rem] font-semibold text-accent-ink">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
          Dastlabki baho. Sudya qarori yozilmoqda…
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {(['claimant', 'respondent'] as MootSide[]).map((s) => (
          <div key={s} className={`surface rounded-[28px] p-5 ${v.winner === s ? 'ring-2 ring-accent' : ''}`}>
            <p className="text-[0.8rem] font-semibold text-ink-2">{SIDE[s]}{side === s ? ' · siz' : ''}</p>
            <p className="display mt-1 text-4xl font-semibold tabular-nums">{v.totals[s]}<span className="text-lg font-normal text-ink-3"> / 100</span></p>
            {v.winner === s && <p className="mt-1 text-[0.8rem] font-semibold text-accent-ink">{v.forfeit ? 'Texnik gʻalaba' : 'Gʻolib'}</p>}
          </div>
        ))}
      </div>

      {!v.forfeit && (
        <section className="mt-4 surface rounded-[28px] p-5" aria-labelledby="crit-title">
          <h2 id="crit-title" className="display text-lg font-semibold">Mezonlar boʻyicha</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-[0.9rem]">
              <thead><tr className="text-[0.76rem] text-ink-3"><th className="pb-2 font-semibold">Mezon</th><th className="pb-2 text-right font-semibold">Daʼvogar</th><th className="pb-2 text-right font-semibold">Javobgar</th><th className="pb-2 pl-4 font-semibold">Nima oʻlchanadi</th></tr></thead>
              <tbody>
                {v.criteria.map((c) => (
                  <tr key={c.id} className="border-t border-line align-top">
                    <td className="py-2 font-semibold">{c.label}</td>
                    <td className="py-2 text-right tabular-nums">{c.claimant}<span className="text-ink-3"> / {c.max}</span></td>
                    <td className="py-2 text-right tabular-nums">{c.respondent}<span className="text-ink-3"> / {c.max}</span></td>
                    <td className="py-2 pl-4 text-ink-2">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-2xl bg-paper px-3 py-2 text-[0.82rem] text-ink-2">
            {v.engine === 'model'
              ? 'Baho sud serveridagi til modeli tomonidan berildi: chiqishlar mazmuni ish materiallari bilan solishtirildi. Bu oʻquv bahsi natijasi - haqiqiy sud qarori emas.'
              : 'Dastlabki baho: shakl va qamrov oʻlchandi (soʻzdan foydalanish, odob, ish faktlariga tayanish, raqibga javob, huquqiy havola). Dalillarning mazmunan kuchi hali baholanmadi - bu sud serveridagi til modeli ulangach qoʻshiladi.'}
          </p>
        </section>
      )}

      {room.case.debrief && <Debrief d={room.case.debrief} />}

      <section className="mt-4 surface rounded-[28px] p-5" aria-labelledby="people-title">
        <h2 id="people-title" className="display text-lg font-semibold">Ishtirokchilar</h2>
        <ul className="mt-2 divide-y divide-line">
          {v.players.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 text-[0.92rem]">
              <span className="font-semibold">{p.name}{p.id === room.me.id && <span className="font-normal text-ink-3"> · siz</span>} <span className="font-normal text-ink-3">· {SIDE[p.side].toLowerCase()}</span></span>
              <span className="text-ink-2">{p.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-4">
        <PracticeRecord
          scope={`moot:${room.code}`}
          lines={lines}
          meta={{ title: `Bahs · ${room.case.title}`, subtitle: side ? `${SIDE[side]}${room.me.role ? ` · ${ROLE[room.me.role][0].toLowerCase()}` : ''} · xona ${room.code}` : `Xona ${room.code}`, student: mine?.name ?? getProfile()?.name ?? '', date: new Date(room.transcript[0]?.at ?? room.now), score: side ? v.totals[side] : null, outcome: v.winner === null ? 'durang' : won ? 'jamoa ustun keldi' : 'raqib ustun keldi', slug: `bahs-${room.code.toLowerCase()}` }}
          analysis={{ criteria: side && !v.forfeit ? v.criteria.map((c) => ({ label: c.label, score: c[side], max: c.max, explanation: c.note })) : [], strengths: [], errors: mine ? [mine.note] : [] }}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/bahs" className="btn btn-primary">Yangi bahs</Link>
        <Link href="/hub" className="btn btn-quiet">Bosh sahifa</Link>
      </div>
    </main>
  );
}

/* ───────────────────────── the page ───────────────────────── */

function JoinGate({ code, error, onJoined }: { code: string; error: ApiError; onJoined: (r: MootRoom) => void }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<'man' | 'woman'>('man');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canJoin = error.code === 'not_in_room';
  return (
    <main className="mx-auto grid w-full max-w-md flex-1 place-items-center px-5 py-16">
      <div className="w-full surface rounded-[28px] p-6 text-center">
        <p className="font-mono text-2xl font-semibold tracking-[0.2em]">{code}</p>
        {canJoin ? (
          <form className="mt-4 space-y-3 text-left" onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 2 || busy) return;
            setBusy(true);
            saveProfile({ name: name.trim(), avatar, role: getProfile()?.role ?? 'student' });
            moot.join(code, name.trim(), avatar).then(onJoined, (err) => { setMessage(err instanceof ApiError ? err.message : 'Qoʻshilib boʻlmadi'); setBusy(false); });
          }}>
            <h1 className="display text-center text-xl font-semibold">Bahsga qoʻshilish</h1>
            <label className="block"><span className="text-[0.8rem] font-semibold text-ink-2">Ismingiz</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus className="field mt-1.5" placeholder="Masalan: Karimova Aziza" /></label>
            <div role="radiogroup" aria-label="Qiyofa" className="grid grid-cols-2 gap-1 rounded-2xl bg-paper p-1">
              {(['man', 'woman'] as const).map((a) => <button key={a} type="button" role="radio" aria-checked={avatar === a} onClick={() => setAvatar(a)} className={`min-h-11 rounded-xl text-[0.9rem] font-semibold ${avatar === a ? 'bg-card shadow-sm' : 'text-ink-3'}`}>{a === 'man' ? 'Erkak' : 'Ayol'}</button>)}
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={name.trim().length < 2 || busy}>{busy ? 'Qoʻshilmoqda…' : 'Qoʻshilish'}</button>
            {message && <p className="text-center text-[0.88rem] text-danger" role="alert">{message}</p>}
          </form>
        ) : (
          <>
            <h1 className="display mt-3 text-xl font-semibold">{error.status === 404 ? 'Xona topilmadi' : 'Xonaga ulanib boʻlmadi'}</h1>
            <p className="mt-1 text-[0.92rem] text-ink-2">{error.status === 404 ? 'Kod notoʻgʻri yoki xona yopilgan. Xona egasidan yangi kod soʻrang.' : error.message}</p>
            <Link href="/bahs" className="btn btn-primary mt-5 w-full">Bahs sahifasiga</Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function MootClient() {
  const code = String(useParams<{ code: string }>().code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  const { room, error, act, take, skew, rejoin } = useRoom(code);
  const [notice, setNotice] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const clear = useCallback(() => setNotice(null), []);
  const showVerdict = useCallback(() => setShown(true), []);

  if (!room) {
    if (error && (error.status === 404 || error.code === 'not_in_room' || error.status === 409)) return <JoinGate code={code} error={error} onJoined={(r) => { take(r); rejoin(); }} />;
    return (
      <main className="grid flex-1 place-items-center px-5 py-24 text-center">
        <div>
          <p className="display text-xl font-semibold">{error ? 'Aloqa uzildi' : 'Xonaga ulanmoqda…'}</p>
          {error && <p className="mt-1 text-[0.92rem] text-ink-2">Qayta ulanishga urinilmoqda. Internetni tekshiring.</p>}
        </div>
      </main>
    );
  }
  return (
    <MotionConfig reducedMotion="user">
      {room.phase === 'lobby' && <Lobby room={room} act={act} say={setNotice} />}
      {room.phase === 'briefing' && <Briefing room={room} act={act} say={setNotice} skew={skew} />}
      {(room.phase === 'hearing' || (room.phase === 'verdict' && !shown)) && <Hearing room={room} act={act} say={setNotice} skew={skew} onVerdict={showVerdict} />}
      {room.phase === 'verdict' && shown && <Verdict room={room} />}
      {error && room.phase !== 'verdict' && <p role="status" className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1d1d1f] px-4 py-2 text-[0.84rem] font-medium text-white shadow-xl">Aloqa uzildi - qayta ulanmoqda…</p>}
      <Notice text={notice} onClose={clear} />
    </MotionConfig>
  );
}
