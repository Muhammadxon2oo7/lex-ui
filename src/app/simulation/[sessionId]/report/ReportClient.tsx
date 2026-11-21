'use client';
/**
 * Assessment report. Pure DOM (no 3D bundle): score, six criteria, evidence
 * quoted from the transcript, sources with their verification status, the
 * ideal path, and the appeal-to-mentor flow.
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { isOfficialSource, type Assessment, type Snapshot, type Source } from '@/contracts';
import { PracticeRecord } from '@/components/record/PracticeRecord';
import { ApiError, api } from '@/game/api';
import { courtStageFor } from '@/game/courtStage';
import type { RecordLine, RecordMeta } from '@/game/practiceRecord';
import { useProfile } from '@/game/profile';

const COURT_LABEL = { judge: 'Sudya', secretary: 'Sud majlisi kotibi', opponent: 'Raqib tomon vakili', witness: 'Guvoh', expert: 'Ekspert' } as const;
/** «Title: message» — unless the message already starts with its title. */
const line = (f: { title: string; message: string }) => (f.message.startsWith(f.title) ? f.message : `${f.title}: ${f.message}`);
const LEVEL_NAME = { beginner: 'boshlangʻich', intermediate: 'oʻrta', advanced: 'professional' } as const;

function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {sources.map((s) => (
        <li key={s.title} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem]">
          {/* Only allow-listed hosts are ever presented as an official source link. */}
          {isOfficialSource(s.officialUrl) ? (
            <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-navy underline decoration-line underline-offset-2">
              {s.title}
            </a>
          ) : (
            <span className="font-medium">{s.title}</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${s.verifiedAt ? 'bg-accent-soft text-accent-ink' : 'bg-warn-soft text-warn'}`}>
            {s.verifiedAt ? `lex.uz · tahrir ${s.effectiveAt ?? s.verifiedAt}` : 'Modda va tahrir sanasi: mentor tekshirsin'}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportClient() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  // whose report: the economic court (court server) or the DXM office — from the session itself
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const court = sessionId.startsWith('rmt_');
  const title = snap ? `${court ? 'Iqtisodiy sud' : 'DXM xodimi'} · ${snap.scenario.title}` : null;
  const profile = useProfile();

  useEffect(() => {
    let cancelled = false;
    api.getSession(sessionId).then(
      (s) => !cancelled && setSnap(s),
      () => {},
    );
    api.report(sessionId).then(
      (r) => !cancelled && setReport(r),
      (e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Hisobotni yuklab boʻlmadi'),
    );
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // the practice record: the whole session in order, the student by name, the actors in their voices
  const record = useMemo(() => {
    if (!report) return null;
    const voices = court && snap ? courtStageFor(snap.scenario).voices : null;
    const student = profile?.name?.trim() || 'Talaba';
    const lines: RecordLine[] = report.turns.map((t) =>
      t.speaker === 'user'
        ? { who: student, role: 'student', text: t.text }
        : t.speaker === 'system'
          ? { who: '', role: 'system', text: t.text }
          : { who: court ? (t.role ? COURT_LABEL[t.role] : 'Sud') : (snap?.scenario.npc.name ?? 'Fuqaro'), role: 'npc', text: t.text, voice: (t.role && voices?.[t.role]) || 'elder_m', emotion: t.emotion },
    );
    const level = snap?.level ? `${LEVEL_NAME[snap.level]} daraja` : null;
    const meta: RecordMeta = {
      // «Ijara qarzi va penya — daʼvogar vakili»: the role is in the subtitle already
      title: snap ? `${court ? 'Iqtisodiy sud' : 'DXM xodimi'} · ${snap.scenario.title.split(/\s+[—–-]\s+/)[0]}` : court ? 'Iqtisodiy sud' : 'DXM xodimi',
      subtitle: [snap?.scenario.briefing.position, level].filter(Boolean).join(' · '),
      student,
      date: new Date(report.evaluatedAt),
      score: report.zeroedByEthics ? 0 : report.scoreTotal,
      outcome: report.outcome.title,
      slug: report.scenarioId,
    };
    return {
      meta,
      lines,
      analysis: {
        criteria: report.criteria.map((c) => ({ label: c.label, score: report.zeroedByEthics ? 0 : c.score, max: c.max, explanation: c.explanation })),
        decisions: report.decisions,
        strengths: report.feedback.filter((f) => f.kind === 'strength').map(line),
        errors: report.feedback.filter((f) => f.kind === 'error').map(line),
      },
    };
  }, [report, snap, court, profile?.name]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="display text-2xl font-semibold">Hisobot ochilmadi</h1>
          <p className="mt-2 text-ink-2">{error}</p>
          <Link href="/kampus" className="btn btn-primary mt-6">Yoʻlakka qaytish</Link>
        </div>
      </main>
    );
  }
  if (!report) return <main className="grid min-h-dvh place-items-center text-ink-3" role="status">Hisobot tayyorlanmoqda…</main>;

  const tone = report.scoreTotal >= 80 ? 'text-accent-ink' : report.scoreTotal >= 55 ? 'text-warn' : 'text-danger';
  const strengths = report.feedback.filter((f) => f.kind === 'strength');
  const errors = report.feedback.filter((f) => f.kind === 'error');
  const mentor = report.feedback.find((f) => f.kind === 'mentor-review');
  const turnNo = (id: string) => report.turns.findIndex((t) => t.id === id) + 1;

  const sendAppeal = async () => {
    setSending(true);
    try {
      setReport(await api.appeal(sessionId, reason));
      setReason('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Yuborib boʻlmadi');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:py-14">
      <p className="text-[0.78rem] font-semibold uppercase tracking-wider text-accent-ink">Hisobot{title ? ` · ${title}` : ''}</p>
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        <p className={`display text-[clamp(4rem,14vw,7rem)] font-semibold tabular-nums ${tone}`} aria-label={`Umumiy ball: 100 dan ${report.scoreTotal}`}>
          {report.scoreTotal}
          <span className="text-[0.35em] font-medium text-ink-3"> / 100</span>
        </p>
        <div className="pb-3">
          <h1 className="display text-2xl font-semibold">{report.outcome.title}</h1>
          <p className="mt-1 max-w-[46ch] text-ink-2">{report.outcome.description}</p>
        </div>
      </div>
      {report.zeroedByEthics && (
        <p className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 font-medium text-danger" role="alert">
          Pora qabul qilingani uchun natija qolgan mezonlardan qatʼi nazar 0 ballga tushirildi.
        </p>
      )}
      <p className="mt-4 inline-flex rounded-full bg-warn-soft px-3 py-1 text-[0.78rem] font-semibold text-warn">
        {report.reviewStatus === 'mentor-approved' ? 'Mentor tasdiqlagan' : report.appeal ? 'Eʼtiroz yuborilgan — mentor koʻrib chiqadi' : 'Avtomatik baho · mentor tasdigʻi kutilmoqda'}
      </p>

      <section className="mt-8 rounded-[24px] border border-line bg-card p-6" aria-labelledby="criteria">
        <h2 id="criteria" className="text-lg font-semibold">Mezonlar boʻyicha</h2>
        <ul className="mt-4 space-y-4">
          {report.criteria.map((c) => (
            <li key={c.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{c.label}</span>
                <span className="tabular-nums text-ink-2"><strong className="text-ink">{report.zeroedByEthics ? 0 : c.score}</strong> / {c.max}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper" aria-hidden>
                <div className="h-full rounded-full bg-accent" style={{ width: `${((report.zeroedByEthics ? 0 : c.score) / c.max) * 100}%`, opacity: 0.35 + 0.65 * (c.score / c.max) }} />
              </div>
              <p className="mt-1.5 text-[0.86rem] text-ink-2">
                {c.explanation}
                {c.supportingTurnIds.length > 0 && <span className="text-ink-3"> · {c.supportingTurnIds.map((id) => `${turnNo(id)}-replika`).join(', ')}</span>}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {record && (
        <div className="mt-4">
          <PracticeRecord meta={record.meta} lines={record.lines} analysis={record.analysis} scope={sessionId} xapi={() => ({ session: sessionId, scenario: report.scenarioId, score: report.scoreTotal, outcome: report.outcome.id, criteria: report.criteria, decisions: report.decisions ?? [], turns: report.turns.map(({ id, speaker, role, text, at, engine }) => ({ id, speaker, role, text, at, engine })), engines: report.turns.reduce<Record<string, number>>((n, t) => (t.engine ? { ...n, [t.engine]: (n[t.engine] ?? 0) + 1 } : n), {}) })} />
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-[24px] border border-line bg-card p-6" aria-labelledby="strengths">
          <h2 id="strengths" className="text-lg font-semibold">Kuchli tomonlar</h2>
          {strengths.length === 0 && <p className="mt-2 text-[0.9rem] text-ink-3">Bu safar ajralib turgan kuchli tomon qayd etilmadi.</p>}
          <ul className="mt-3 space-y-4">
            {strengths.map((f) => (
              <li key={f.title}>
                <p className="font-semibold text-accent-ink">{f.title}</p>
                <p className="text-[0.9rem] text-ink-2">{f.message}</p>
                {f.quote && <blockquote className="mt-1.5 border-l-2 border-accent pl-3 text-[0.86rem] italic text-ink-2">“{f.quote}”</blockquote>}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[24px] border border-line bg-card p-6" aria-labelledby="errors">
          <h2 id="errors" className="text-lg font-semibold">Asosiy xatolar</h2>
          {errors.length === 0 && <p className="mt-2 text-[0.9rem] text-ink-3">Jiddiy xato qayd etilmadi.</p>}
          <ul className="mt-3 space-y-5">
            {errors.map((f) => (
              <li key={f.title}>
                <p className="font-semibold text-danger">
                  {f.title}
                  {f.relatedTurnIds[0] && <span className="ml-2 text-[0.78rem] font-medium text-ink-3">{turnNo(f.relatedTurnIds[0])}-replika</span>}
                </p>
                <p className="text-[0.9rem] text-ink-2">{f.message}</p>
                {f.quote && <blockquote className="mt-1.5 border-l-2 border-danger pl-3 text-[0.86rem] italic text-ink-2">“{f.quote}”</blockquote>}
                <Sources sources={f.sources} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {report.betterAnswer && (
        <section className="mt-4 rounded-[24px] border border-line bg-card p-6" aria-labelledby="better">
          <h2 id="better" className="text-lg font-semibold">Qanday aytish kerak edi</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <p className="rounded-2xl bg-danger-soft p-4 text-[0.92rem]"><span className="mb-1 block text-[0.72rem] font-semibold uppercase tracking-wider text-danger">Siz aytdingiz</span>{report.betterAnswer.original}</p>
            <p className="rounded-2xl bg-accent-soft p-4 text-[0.92rem]"><span className="mb-1 block text-[0.72rem] font-semibold uppercase tracking-wider text-accent-ink">Namuna</span>{report.betterAnswer.improved}</p>
          </div>
          <p className="mt-3 text-[0.88rem] text-ink-2">{report.betterAnswer.why}</p>
        </section>
      )}

      {/* court sessions: every decision, what it cost and what would have been better (debrief) */}
      {report.decisions && report.decisions.length > 0 && (
        <section className="mt-4 rounded-[24px] border border-line bg-card p-6" aria-labelledby="debrief">
          <h2 id="debrief" className="text-lg font-semibold">Tahlil — har bir gapingiz</h2>
          <p className="mt-1 text-[0.84rem] text-ink-3 tabular-nums">
            {report.decisions.filter((d) => d.tone !== 'info').length} ta gap · {report.decisions.filter((d) => d.tone === 'bad').length} ta xato · {report.hints ?? 0} ta maslahat
          </p>
          <ol className="mt-3 space-y-2">
            {report.decisions.map((d, i) => (
              <li key={i} className={`rounded-2xl px-4 py-3 text-[0.9rem] leading-snug ${d.tone === 'bad' ? 'bg-danger-soft' : 'bg-black/[0.035]'}`}>
                {d.prompt && <p className="line-clamp-2 text-[0.8rem] text-ink-3">«{d.prompt}»</p>}
                <p className="mt-0.5 flex gap-2">
                  <span aria-hidden className={d.tone === 'bad' ? 'text-danger' : d.tone === 'good' ? 'text-accent-ink' : 'text-ink-3'}>{d.tone === 'bad' ? '✗' : d.tone === 'good' ? '✓' : '•'}</span>
                  <span><span className="sr-only">{d.tone === 'bad' ? 'Xato: ' : d.tone === 'good' ? 'Toʻgʻri: ' : ''}</span>{d.chose}</span>
                </p>
                {(d.why || d.better) && (
                  <div className="mt-1.5 space-y-1 pl-5 text-[0.86rem]">
                    {d.why && <p className={d.tone === 'bad' ? 'text-danger' : 'text-ink-2'}>{d.points ? `−${Math.abs(d.points)} · ` : ''}{d.why}</p>}
                    {d.better && <p className="text-ink-2"><span className="font-semibold text-accent-ink">Yaxshiroq: </span>{d.better}</p>}
                  </div>
                )}
                {d.article && <p className="mt-1.5 pl-5 text-[0.78rem] font-semibold text-ink-3">{d.article}</p>}
              </li>
            ))}
          </ol>
          {report.reflect && <p className="mt-4 rounded-2xl bg-accent-soft p-4 text-[0.92rem]"><span className="mb-1 block text-[0.72rem] font-semibold uppercase tracking-wider text-accent-ink">Mulohaza uchun</span>{report.reflect}</p>}
        </section>
      )}

      <section className="mt-4 rounded-[24px] border border-line bg-card p-6" aria-labelledby="ideal">
        <h2 id="ideal" className="text-lg font-semibold">Ideal yoʻl bilan taqqoslash</h2>
        <ol className="mt-3 space-y-2">
          {report.idealPath.map((p, i) => (
            <li key={p.step} className="flex gap-3 text-[0.93rem]">
              <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ${p.done ? 'bg-accent text-white' : 'bg-paper text-ink-3'}`}>{p.done ? '✓' : i + 1}</span>
              <span className={p.done ? '' : 'text-ink-2'}>{p.step}<span className="sr-only">{p.done ? ' — bajarildi' : ' — bajarilmadi'}</span></span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[0.86rem] text-ink-3">Aniqlangan faktlar: {report.facts.length} / {report.factsTotal}</p>
      </section>

      {mentor && (
        <section className="mt-4 rounded-[24px] bg-navy p-6 text-white" aria-labelledby="sources">
          <h2 id="sources" className="text-lg font-semibold">Huquqiy manbalar</h2>
          <p className="mt-2 max-w-[70ch] text-[0.9rem] leading-relaxed text-white/80">{mentor.message}</p>
          <ul className="mt-3 space-y-1 text-[0.9rem]">
            {mentor.sources.map((s) => (
              <li key={s.title}>
                {isOfficialSource(s.officialUrl) ? (
                  <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/40 underline-offset-2">{s.title}</a>
                ) : s.title}
                <span className="text-white/55"> — lex.uz, amaldagi tahrir tekshirilmagan</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="mt-4 rounded-[24px] border border-line bg-card p-6">
        <summary className="cursor-pointer text-lg font-semibold">Suhbat yozuvi ({report.turns.length} replika)</summary>
        <ol className="mt-4 space-y-2 text-[0.9rem]">
          {report.turns.map((t, i) => (
            <li key={t.id} className="flex gap-3">
              <span className="w-6 shrink-0 text-right tabular-nums text-ink-3">{i + 1}</span>
              <p><strong className={t.speaker === 'user' ? 'text-accent-ink' : ''}>{t.speaker === 'user' ? 'Siz' : t.speaker === 'npc' ? 'Rustam aka' : 'Vaziyat'}:</strong> {t.text}</p>
            </li>
          ))}
        </ol>
      </details>

      <section className="mt-4 rounded-[24px] border border-line bg-card p-6" aria-labelledby="appeal">
        <h2 id="appeal" className="text-lg font-semibold">Bahoga eʼtiroz</h2>
        {report.appeal ? (
          <p className="mt-2 text-[0.92rem] text-ink-2" role="status">Eʼtirozingiz qabul qilindi va oʻqituvchiga yuboriladi: “{report.appeal.reason}”</p>
        ) : (
          <>
            <label htmlFor="appeal-text" className="mt-2 block text-[0.9rem] text-ink-2">Baho adolatsiz deb hisoblasangiz, sababini yozing — ish oʻqituvchi koʻrigiga oʻtadi.</label>
            <textarea id="appeal-text" className="field mt-2 min-h-24" maxLength={1500} value={reason} onChange={(e) => setReason(e.target.value)} />
            <button type="button" className="btn btn-dark mt-3" disabled={sending || reason.trim().length < 10} onClick={() => void sendAppeal()}>
              Oʻqituvchiga eʼtiroz yuborish
            </button>
          </>
        )}
      </section>

      <section className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-accent-soft p-6">
        <div>
          <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-accent-ink">Keyingi qadam</p>
          <p className="mt-1 text-lg font-semibold">{report.nextScenario.title}</p>
          <p className="text-[0.9rem] text-ink-2">{report.nextScenario.reason}</p>
        </div>
        <Link href="/kampus" className="btn btn-primary">Yoʻlakka qaytish</Link>
      </section>
      <p className="mt-6 text-[0.78rem] text-ink-3">Rubrika: {report.rubricVersion} · {new Date(report.evaluatedAt).toLocaleString('uz-UZ')}</p>
    </main>
  );
}
