// End-to-end QA of the moot court ("Bahs"): two browsers, one room, a whole hearing to the verdict.
//   node tools/qa/moot.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] ?? 'qa-shots/moot';
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const logs = [];
const person = async (name, viewport) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && logs.push(`[${name}] ${m.text().slice(0, 240)}`));
  page.on('pageerror', (e) => logs.push(`[${name}] pageerror ${e.message.slice(0, 240)}`));
  return page;
};
const results = [];
const check = (name, ok, note = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`); };
const shot = async (page, name) => { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${name}.png` }); };

const a = await person('A', { width: 1440, height: 810 });
const b = await person('B', { width: 390, height: 844 });

// A opens a 1-on-1 room
await a.goto(`${BASE}/bahs`);
await a.getByPlaceholder('Masalan: Karimova Aziza').fill('Aziza Karimova');
await a.getByRole('radio', { name: 'Ayol' }).click();
await a.getByRole('radio', { name: /1 ga 1/ }).click();
await shot(a, '01-home');
await a.getByRole('button', { name: 'Xona ochish' }).click();
await a.waitForURL(/\/bahs\/[A-Z0-9]{5}$/);
const code = a.url().split('/').pop();
check('room opened', /^[A-Z0-9]{5}$/.test(code), code);

// B opens the shared link without a profile → the join gate
await b.goto(`${BASE}/bahs/${code}`);
await b.getByRole('heading', { name: 'Bahsga qoʻshilish' }).waitFor({ timeout: 15000 });
await b.getByPlaceholder('Masalan: Karimova Aziza').fill('Bobur Aliyev');
await b.getByRole('button', { name: 'Qoʻshilish' }).click();
await b.getByRole('button', { name: 'Tayyorman' }).waitFor({ timeout: 15000 });
await a.getByText('Bobur Aliyev').waitFor({ timeout: 15000 });
check('second player appears for the host (long poll)', true);
await shot(a, '02-lobby-host');
await shot(b, '02-lobby-phone');
check('host cannot start before others are ready', await a.getByRole('button', { name: /Qurʼa tashlash/ }).isDisabled());
await b.getByRole('button', { name: 'Tayyorman' }).click();
await a.getByRole('button', { name: /Qurʼa tashlash/ }).click();

// briefing: each sees a side, only their own confidential facts
for (const p of [a, b]) await p.getByText('Qurʼa natijasi').waitFor({ timeout: 15000 });
const sideOf = async (p) => ((await p.getByRole('heading', { level: 1 }).innerText()).includes('daʼvogar') ? 'claimant' : 'respondent');
const sa = await sideOf(a), sb = await sideOf(b);
check('sides are opposite', sa !== sb, `A ${sa}, B ${sb}`);
const secret = async (p) => p.getByText('Faqat sizning jamoangiz biladi', { exact: true }).locator('..').innerText();
check('confidential facts differ per side', (await secret(a)) !== (await secret(b)));
await shot(a, '03-briefing');
await shot(b, '03-briefing-phone');
for (const p of [a, b]) await p.getByRole('button', { name: /Oʻqib boʻldim/ }).click();

// hearing
for (const p of [a, b]) await p.getByRole('button', { name: /Bayon/ }).waitFor({ timeout: 20000 });
check('hearing started when both were ready (no waiting for the clock)', true);
await a.waitForTimeout(6000);
await shot(a, '04-hearing-open');
const SAY = {
  claimant: 'Hurmatli sud! 32-P-sonli ijara shartnomasi boʻyicha javobgar hisob-fakturalarni imzolagan, joydan foydalangan, ammo ijara haqini toʻlamagan. Asosiy qarz va shartnomaning 8.5-bandidagi penyani undirishni soʻraymiz. Dalolatnoma imzolanmagan boʻlsa-da, foydalanish faktura bilan tasdiqlanadi.',
  respondent: 'Hurmatli sud! Topshirish dalolatnomasi imzolanmagan, obyekt rasman topshirilmagan. Mijoz joydan atigi uch oy foydalangan. Penya nomutanosib, moliyaviy ahvol ogʻirligini inobatga olib kamaytirishni soʻraymiz. Hisob-fakturalar boʻyicha qarz miqdoriga eʼtirozimiz bor.',
};
const people = [[a, sa, 'A'], [b, sb, 'B']];
let floors = 0, shotMine = false, shotOther = false;
const until = Date.now() + 6 * 60_000;
while (Date.now() < until) {
  if (await a.getByRole('heading', { name: /ustun keldi|Durang/ }).count()) break;
  for (const [p, side, tag] of people) {
    const input = p.getByLabel('Chiqishingiz matni');
    if (!(await input.count())) continue;
    const other = p === a ? b : a;
    if (!shotOther) { await shot(other, `05-hearing-listening-${other === b ? 'phone' : 'desktop'}`); shotOther = true; }
    await input.fill(SAY[side]);
    await p.getByRole('button', { name: 'Aytish' }).click();
    await p.getByRole('button', { name: 'Soʻzimni tugatdim' }).waitFor({ timeout: 10000 });
    if (!shotMine) { await shot(p, `05-hearing-my-floor-${tag}`); shotMine = true; }
    await p.getByRole('button', { name: 'Soʻzimni tugatdim' }).click();
    floors += 1;
    await p.waitForTimeout(400);
  }
  for (const p of [a, b]) {
    const skip = p.getByRole('button', { name: 'Natijaga oʻtish' });
    if (await skip.count()) await skip.click().catch(() => {});
  }
  await a.waitForTimeout(500);
}
check('all twelve floors were taken in turn', floors === 12, `${floors}`);
for (const p of [a, b]) await p.getByRole('heading', { name: /ustun keldi|Durang/ }).waitFor({ timeout: 60000 });
check('both reach the verdict', true);
const ha = await a.getByRole('heading', { level: 1 }).innerText(), hb = await b.getByRole('heading', { level: 1 }).innerText();
check('one side wins and the other sees the opposite', ha !== hb || /Durang/.test(ha), `A: ${ha} | B: ${hb}`);
check('the verdict says which engine judged', (await a.getByText(/Dastlabki baho|til modeli tomonidan/).count()) > 0);
await shot(a, '06-verdict');
await a.evaluate(() => window.scrollTo(0, 700));
await shot(a, '06-verdict-2');
await shot(b, '06-verdict-phone');

// a stranger cannot read the room
const c = await person('C', { width: 800, height: 600 });
const res = await c.request.get(`${BASE}/api/v1/moot/rooms/${code}`);
check('outsider gets 403 from the room API', res.status() === 403, String(res.status()));

console.log(logs.length ? `\nconsole:\n${[...new Set(logs)].slice(0, 12).join('\n')}` : '\nconsole: clean');
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
