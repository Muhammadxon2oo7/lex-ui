'use client';
/** One line of practice: its cases (the system's and people's), each opened in a sheet with its modes. */
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import type { Domain, LibCase } from '@/contracts/library';
import { api, ApiError } from '@/game/api';
import { library, MODE_LABEL } from '@/game/library';
import { pickScenario } from '@/game/randomCase';
import { ensureCase } from '@/game/rooms';
import { GlassLayer, GlassToolbar, Segmented, ToolbarLink } from '@/components/ui/glass';
import { Sheet } from '@/components/ui/Sheet';
import { ease, note } from '@/lib/motion';
import { Badges, CaseView } from './CaseView';
import { Composer } from './Composer';
import { Solutions } from './Solutions';

/** Cases that live on the court server's case-lab (solutions, sharing); the built-in ones do not. */
const onLab = (c: LibCase) => /^[us]_/.test(c.id);

/** Where a mode of a case leads. */
async function startMode(mode: string, domain: Domain, c: LibCase, code?: string): Promise<string> {
  if (mode === 'moot') return `/bahs?case=${encodeURIComponent(c.id)}${c.mine && c.shareCode ? `&code=${encodeURIComponent(c.shareCode)}` : code ? `&code=${encodeURIComponent(code)}` : ''}`;
  if (mode === 'path') {
    if (domain.id === 'dxm') return `/simulation/${(await api.createSession('dxm-yoqolgan-staj', 'tutorial')).sessionId}`;
    const kind = domain.id === 'theft' ? 'theft' : 'labour';
    const k = await ensureCase(false, kind);
    return `/ish/${k.caseId}/${k.stages.find((s) => s.status !== 'done')?.id ?? k.stages[0].id}`;
  }
  // court: the economic courtroom with the court server's scenario of this case (or of this domain)
  const r = await api.remoteStatus();
  const ids = r.ok ? r.scenarios.map((s) => s.id) : [];
  const id = ids.includes(c.id) ? c.id : pickScenario(ids);
  if (!id) throw new Error('Sud serveri hozir javob bermayapti');
  return `/sud/${(await api.createSession(id, 'tutorial', 'beginner')).sessionId}`;
}

export default function DomainCases() {
  const id = String(useParams<{ domain: string }>().domain ?? '');
  const router = useRouter();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [cases, setCases] = useState<LibCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<LibCase | null>(null);
  const [composing, setComposing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // a private case shared by its author: /sohalar/{domain}?case={id}&code={code}
  const params = useSearchParams();
  const sharedId = params.get('case');
  const sharedCode = params.get('code') ?? undefined;
  useEffect(() => {
    if (!sharedId) return;
    let alive = true;
    library.case(sharedId, sharedCode).then((c) => alive && setOpen(c), (e) => alive && setError(e instanceof ApiError ? e.message : 'Case ochilmadi'));
    return () => {
      alive = false;
    };
  }, [sharedId, sharedCode]);
  const share = async (c: LibCase) => {
    const url = `${location.origin}/sohalar/${encodeURIComponent(id)}?case=${encodeURIComponent(c.id)}${c.shareCode ? `&code=${encodeURIComponent(c.shareCode)}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(`Havola: ${url}`);
    }
  };
  const toggle = async (c: LibCase) => {
    try {
      const next = await library.visibility(c.id, c.visibility === 'public' ? 'private' : 'public');
      setOpen(next);
      setCases((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? l);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Oʻzgartirib boʻlmadi');
    }
  };

  useEffect(() => {
    let alive = true;
    library.domains().then((d) => alive && setDomain(d.domains.find((x) => x.id === id) ?? null), () => {});
    return () => {
      alive = false;
    };
  }, [id]);
  const load = useCallback(() => {
    setCases(null);
    setError(null);
    library.cases(id, scope).then(setCases, (e) => setError(e instanceof ApiError ? e.message : 'Caselar yuklanmadi'));
  }, [id, scope]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on domain/scope change
    load();
  }, [load]);

  const modesOf = (c: LibCase) => (c.modes?.length ? c.modes : domain?.modes ?? []).filter((m) => m !== 'moot' || c.status === 'approved' || c.source === 'system');
  const go = async (mode: string, c: LibCase) => {
    if (!domain || starting) return;
    setStarting(`${c.id}:${mode}`);
    try {
      router.push(await startMode(mode, domain, c, sharedCode));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ochib boʻlmadi');
      setStarting(null);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative isolate w-full flex-1">
        <GlassLayer />
        <GlassToolbar back={{ href: '/sohalar', label: 'SOHALAR' }}>
          <ToolbarLink href="/manbalar">Manbalar</ToolbarLink>
        </GlassToolbar>
        <div className="mx-auto w-full max-w-5xl px-5 pt-8 pb-16 sm:pt-12">
          <p className="text-[0.8rem] font-semibold tracking-wider text-accent-ink uppercase">{domain ? `${domain.caseType ?? ''} ${domain.codes.length ? `· ${domain.codes.join(', ')}` : ''}`.trim() || 'Soha' : 'Soha'}</p>
          <h1 className="display mt-2 text-[clamp(2rem,5vw,3.2rem)] font-semibold tracking-tight text-balance">{domain?.title ?? ' '}</h1>
          {domain?.note && <p className="mt-2 max-w-[62ch] text-[0.92rem] text-ink-3">{domain.note}</p>}

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div className="w-64"><Segmented label="Koʻrsatish" size="sm" value={scope} onChange={setScope} options={[['all', 'Hammasi'], ['mine', 'Meniki']]} /></div>
            <button type="button" className="btn btn-primary ml-auto press" disabled={!domain} onClick={() => setComposing(true)}>+ Case qoʻshish</button>
          </div>

          <AnimatePresence>{error && <motion.p key="err" {...note} role="alert" className="mt-5 rounded-2xl bg-danger-soft px-4 py-3 text-[0.92rem] font-medium text-danger">{error}</motion.p>}</AnimatePresence>

          <LayoutGroup>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {!cases && !error && Array.from({ length: 4 }, (_, i) => <li key={i} className="surface h-36 animate-pulse rounded-[24px] motion-reduce:animate-none" />)}
              {cases?.length === 0 && (
                <li className="surface col-span-full rounded-[24px] p-8 text-center">
                  <p className="display text-[1.2rem] font-semibold">{scope === 'mine' ? 'Sizda hali case yoʻq' : 'Bu sohada hali tasdiqlangan case yoʻq'}</p>
                  <p className="mt-1 text-[0.92rem] text-ink-2">Birinchi boʻlib qoʻshing: holatni oddiy soʻz bilan yozasiz, AI uni case qilib tuzadi.</p>
                </li>
              )}
              {cases?.map((c, i) => (
                <motion.li key={c.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...ease.surface, delay: Math.min(0.24, i * 0.04) }}>
                  <button type="button" onClick={() => setOpen(c)} className="surface press flex h-full w-full flex-col rounded-[24px] p-5 text-left transition-shadow duration-300 hover:shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.06),var(--shadow-lift)]">
                    <Badges c={c} />
                    <h2 className="mt-2.5 text-[1.05rem] leading-snug font-semibold text-balance">{c.title}</h2>
                    {c.summary && <p className="mt-1.5 line-clamp-3 text-[0.88rem] leading-relaxed text-ink-2">{c.summary}</p>}
                    <span className="mt-auto flex flex-wrap gap-1.5 pt-3">{modesOf(c).map((m) => <span key={m} className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[0.74rem] font-semibold text-ink-2">{MODE_LABEL[m] ?? m}</span>)}</span>
                  </button>
                </motion.li>
              ))}
            </ul>
          </LayoutGroup>
        </div>

        <AnimatePresence>
          {open && (
            <Sheet key={open.id} title={open.title} kicker={domain?.title} wide onClose={() => setOpen(null)} busy={Boolean(starting)}
              footer={
                <div className="flex flex-wrap items-center gap-2">
                  {modesOf(open).length === 0 && <span className="text-[0.84rem] text-ink-3">{open.status === 'approved' ? 'Bu case uchun rejim hali yoʻq.' : 'Mentor tasdiqlagach Bahsga chiqadi.'}</span>}
                  {open.mine && onLab(open) && (
                    <>
                      <button type="button" className="btn btn-quiet press" onClick={() => void toggle(open)}>{open.visibility === 'public' ? 'Yopish' : 'Ochish'}</button>
                      {(open.visibility === 'private' || open.status === 'approved') && <button type="button" className="btn btn-quiet press" onClick={() => void share(open)}>{copied ? 'Nusxalandi ✓' : 'Havolani ulashish'}</button>}
                    </>
                  )}
                  {modesOf(open).map((m, i) => (
                    <button key={m} type="button" className={`btn press ${i === 0 ? 'btn-primary' : 'btn-quiet'}`} disabled={Boolean(starting)} aria-busy={starting === `${open.id}:${m}`} onClick={() => void go(m, open)}>
                      {starting === `${open.id}:${m}` ? 'Ochilmoqda…' : MODE_LABEL[m] ?? m}
                    </button>
                  ))}
                </div>
              }>
              <div className="mb-3"><Badges c={open} /></div>
              <CaseView c={open} />
              {open.mine && onLab(open) && <p className="mt-3 text-[0.82rem] text-ink-3">{open.visibility === 'private' ? 'Yopiq: faqat siz va havolani olganlar koʻradi, mentor tekshiruvi kerak emas.' : 'Ochiq: mentor tasdiqlagach hamma koʻradi va «Bahs»ga chiqadi.'}</p>}
              {onLab(open) && <Solutions caseId={open.id} code={open.mine ? undefined : sharedCode} />}
            </Sheet>
          )}
          {composing && domain && (
            <Composer key="compose" domain={domain} onClose={() => setComposing(false)} onSaved={(c) => {
              setComposing(false);
              setScope('mine');
              setOpen(c);
            }} />
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
