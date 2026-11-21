// QA: the court backend's live procedure (v1.4), driven through OUR API so the Zod adapter is checked too.
// Usage: node tools/qa/live.mjs            (dev server on :3000, LEXSIM_REMOTE_URL set)
const B = (process.env.BASE ?? 'http://localhost:3000') + '/api/v1';
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${what}`);
  if (!ok) failed++;
};

async function court(level) {
  let cookie = '';
  const call = async (path, body) => {
    const t = Date.now();
    const r = await fetch(B + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.getSetCookie?.() ?? [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return { status: r.status, ms: Date.now() - t, j: await r.json().catch(() => null) };
  };
  const s = await call('/sessions', { scenarioId: 'sud-ijara-davogar', mode: 'tutorial', level });
  if (!s.j?.snapshot) throw new Error(`create ${s.status} ${JSON.stringify(s.j).slice(0, 200)}`);
  const id = s.j.snapshot.sessionId;
  for (const action of ['start', 'sit-at-desk', 'stand']) await call(`/sessions/${id}/interactions`, { clientActionId: crypto.randomUUID(), action });
  let seen = (await call(`/sessions/${id}`)).j.snapshot.turns.length;
  /** says one thing; returns the court's new lines, the note and the snapshot */
  const say = async (text) => {
    const r = await call(`/sessions/${id}/turns`, { clientTurnId: crypto.randomUUID(), text, inputMode: 'text' });
    const snap = r.j?.snapshot;
    if (!snap) throw new Error(`turn ${r.status} ${JSON.stringify(r.j).slice(0, 300)}`);
    const lines = snap.turns.slice(seen).filter((t) => t.speaker === 'npc');
    seen = snap.turns.length;
    const said = lines.map((t) => `[${t.role}] ${t.text}`).join(' | ');
    return { lines, said, roles: lines.map((t) => t.role), fb: snap.feedback, snap, ms: r.ms };
  };
  return { id, say, call };
}

// ── beginner: every live move at the merits stage ──
console.log('beginner — live moves');
{
  const { say } = await court('beginner');
  await say('Hurmatli sud, vakolatimni tasdiqlovchi ishonchnomani taqdim etaman.');
  await say('Hurmatli sud, rad bildirmaymiz.');
  await say('Hurmatli sud, huquqlarimiz tushunarli.');
  const toMerits = await say('Hurmatli sud, iltimosnomamiz yoʻq.');
  check(/talablaringiz/i.test(toMerits.said), 'reached the merits stage');

  const weak = await say('Hurmatli sud, javobgar qarzdor.');
  check(weak.roles.includes('judge') && /aniqlashtiring/i.test(weak.said), `weak answer → judge asks to clarify (${weak.ms} ms)`);

  await say('Hurmatli sud, daʼvo talablarini toʻliq quvvatlaymiz: 32-P-sonli ijara shartnomasi boʻyicha javobgar ijara haqini toʻlamagan, qarzni va shartnomadagi penyani undirishni soʻraymiz.');

  const ask = await say('Hurmatli sud, javobgar vakilidan soʻramoqchiman: obyektdan qancha muddat foydalandingiz?');
  check(ask.roles.includes('opponent'), `question to the opponent → the opponent answers (${ask.ms} ms)`);

  const witness = await say('Hurmatli sud, guvohni chaqirishni soʻrab iltimosnoma beraman.');
  check(witness.roles.includes('opponent') && /ajrim/i.test(witness.said), 'witness motion → opponent heard, then a ruling');

  const postpone = await say('Hurmatli sud, ishni keyinga qoldirishni soʻrayman.');
  check(/rad etilsin/i.test(postpone.said), 'postponement without reason → refused');

  const object = await say('Hurmatli sud, javobgar vakilining gapiga eʼtiroz bildiraman, chunki obyekt topshirilmagani haqidagi gap hech qanday dalil bilan tasdiqlanmagan.');
  check(/eʼtiroz|e'tiroz/i.test(object.said), `objection → the court rules on it («${object.said.slice(0, 90)}…»)`);

  const settle = await say('Hurmatli sud, kelishuv bitimi tuzishni taklif qilamiz.');
  check(settle.roles.includes('opponent') && /yozma/i.test(settle.said), 'settlement offer → opponent terms, court asks for it in writing');
}

// ── advanced: no authority shown → the representative is not admitted ──
console.log('advanced — no authority');
{
  const { say, call, id } = await court('advanced');
  await say('Hurmatli sud, men daʼvogar vakiliman, ishni koʻrishni soʻrayman.');
  const r = await say('Hurmatli sud, hujjat hozir yonimda yoʻq, lekin men vakilman.'); // the judge asks once more first
  const snap = (await call(`/sessions/${id}`)).j.snapshot;
  check(snap.status === 'report-ready' || snap.status === 'finishing' || /qoʻyilmaydi|ruxsat/i.test(r.said), `not admitted → ${snap.status} («${r.said.slice(0, 90)}…»)`);
}

// ── v1.4.5 / v1.4.6: unclear answers, swearing, an excuse ──
console.log('unclear and human answers');
{
  const { say } = await court('beginner');
  const r = await say('ha');
  check(r.roles.includes('judge') && !/vakolat tekshirildi/i.test(r.said), `«ha» → the judge asks again («${r.said.slice(0, 70)}…»)`);
  const low = await say('Hurmatli sud, koʻtni tozalash kerak koʻtni.');
  check(low.roles.includes('judge') && !/vakolat tekshirildi/i.test(low.said), 'nonsense → asked again, no step forward');
}
{
  const { say, call, id } = await court('beginner');
  await say('Hurmatli sud, vakolatimni tasdiqlovchi ishonchnomani taqdim etaman.');
  for (let i = 0; i < 3; i++) await say('pashol naxuy');
  const snap = (await call(`/sessions/${id}`)).j.snapshot;
  check(snap.status === 'report-ready', `swearing three times → removed from the hall (${snap.status})`);
}
{
  const { say, call, id } = await court('advanced');
  const first = await say('Hurmatli sud, ishonchnoma uyda qolib ketibdi.');
  check(first.roles.includes('judge'), `an excuse is answered by the judge («${first.said.slice(0, 70)}…»)`);
  await say('Hurmatli sud, uyda qolib ketibdi, olib kelaman.');
  const snap = (await call(`/sessions/${id}`)).j.snapshot;
  check(snap.status === 'report-ready', `advanced, still no authority → not admitted (${snap.status})`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall live-procedure checks passed');
process.exit(failed ? 1 : 0);
