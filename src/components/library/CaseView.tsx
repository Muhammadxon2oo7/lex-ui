'use client';
/** A case as people read it: summary, parties, claim, facts, evidence, legal basis, balance. Shared by the
 *  domain page, the composer preview and the mentor queue. Content on solid surfaces. */
import type { LibCase } from '@/contracts/library';

export const STATUS: Record<LibCase['status'], [string, string]> = {
  draft: ['Qoralama', 'bg-black/[0.06] text-ink-2'],
  review: ['Tekshiruvda', 'bg-warn-soft text-warn'],
  approved: ['Tasdiqlangan', 'bg-accent-soft text-accent-ink'],
  rejected: ['Rad etilgan', 'bg-danger-soft text-danger'],
};

export function Badges({ c }: { c: LibCase }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={`rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold ${c.source === 'system' ? 'bg-ink text-white' : 'bg-black/[0.06] text-ink-2'}`}>{c.source === 'system' ? 'Tizim' : 'Foydalanuvchi'}</span>
      {c.mine && <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[0.72rem] font-semibold text-ink-2">Meniki</span>}
      {c.mine && c.status !== 'approved' && <span className={`rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span>}
    </span>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-[22px] p-4">
      <h3 className="text-[0.72rem] font-semibold tracking-wider text-ink-3 uppercase">{title}</h3>
      <div className="mt-1.5 text-[0.92rem] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function CaseView({ c }: { c: LibCase }) {
  const conf = c.side.claimant.confidential.length + c.side.respondent.confidential.length > 0;
  return (
    <div className="space-y-3">
      {c.reviewNote && c.mine && (
        <p className={`rounded-2xl px-4 py-3 text-[0.9rem] ${c.status === 'rejected' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent-ink'}`}><b>Mentor izohi:</b> {c.reviewNote}</p>
      )}
      {c.summary && <p className="text-[0.98rem] leading-relaxed text-pretty text-ink-2">{c.summary}</p>}
      <Block title="Taraflar">
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]"><dt className="text-ink-3">Daʼvogar</dt><dd>{c.parties.claimant}</dd><dt className="text-ink-3">Javobgar</dt><dd>{c.parties.respondent}</dd></dl>
        {c.court && <p className="mt-1 text-ink-3">{c.court}</p>}
      </Block>
      {c.claim && <Block title="Talab"><p>{c.claim}</p></Block>}
      {c.facts.length > 0 && <Block title="Holatlar"><ul className="space-y-1.5">{c.facts.map((f) => <li key={f.id}><b className="text-ink">{f.title}.</b> {f.text}</li>)}</ul></Block>}
      {c.evidence.length > 0 && <Block title="Dalillar"><ul className="space-y-1.5">{c.evidence.map((f) => <li key={f.id}><b className="text-ink">{f.title}.</b> {f.text}</li>)}</ul></Block>}
      {conf && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(['claimant', 'respondent'] as const).map((s) => (
            <section key={s} className="rounded-[22px] bg-[#fff7e6] p-4 ring-1 ring-[#f0d9a8]">
              <h3 className="text-[0.72rem] font-semibold tracking-wider text-[#8a5a00] uppercase">{s === 'claimant' ? 'Daʼvogar' : 'Javobgar'}: maxfiy</h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.9rem]">{c.side[s].confidential.map((t) => <li key={t}>{t}</li>)}</ul>
            </section>
          ))}
        </div>
      )}
      <Block title="Huquqiy asos">
        {c.legal.length ? (
          <ul className="space-y-2">{c.legal.map((l) => (
            <li key={l.normId}>
              {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline decoration-accent/30 underline-offset-4 hover:decoration-accent">{l.label} ↗</a> : <b>{l.label}</b>}
              {l.why && <span className="block text-[0.86rem]">{l.why}</span>}
            </li>
          ))}</ul>
        ) : <p>Moddalar hali qoʻshilmagan: mentor qoʻshadi.</p>}
      </Block>
      {c.balance && (c.balance.claimant_strong || c.balance.respondent_strong) && (
        <Block title="Muvozanat">
          <div className="grid gap-3 sm:grid-cols-2">
            {(['claimant', 'respondent'] as const).map((s) => (
              <div key={s}>
                <p className="font-semibold text-ink">{s === 'claimant' ? 'Daʼvogar' : 'Javobgar'}</p>
                <p><span className="text-accent-ink">Kuchli: </span>{c.balance![`${s}_strong`] || '-'}</p>
                <p><span className="text-danger">Zaif: </span>{c.balance![`${s}_weak`] || '-'}</p>
              </div>
            ))}
          </div>
        </Block>
      )}
      <p className="text-[0.8rem] text-ink-3">{c.disclaimer}</p>
    </div>
  );
}
