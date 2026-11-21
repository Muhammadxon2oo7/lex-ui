// QA: «Hujjatlar» — the student reads the folder, fills in the advocate's order and WRITES the claim;
// the court is chosen from the court system. Then the claim is filed and the court rules.
//   node tools/qa/draft.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'qa-shots';
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
const results = [];
const check = (name, ok, note = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`); };
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
page.on('console', (m) => m.type() === 'error' && logs.push(`[error] ${m.text().slice(0, 200)}`));
await page.goto(`${BASE}/hub`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
// the consultation, through the API: the facts and papers the drafting room works from
const id = await page.evaluate(async () => {
  const post = async (path, body) => (await fetch(`/api/v1/cases${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  const c = (await post('', { fresh: true })).case;
  let n = 0;
  const act = (b) => post(`/${c.caseId}/act`, { ...b, clientActionId: `qa-draft-${Date.now()}-${++n}` });
  await act({ type: 'enter', stage: 'consult' });
  for (const o of ['greet', 'story', 'docs', 'witness', 'job', 'explain-letter', 'served', 'authority', 'finish']) await act({ type: 'choose', optionId: o });
  await act({ type: 'leave' });
  return c.caseId;
});
await page.goto(`${BASE}/ish/${id}/draft`);
const dialog = page.getByRole('dialog', { name: /Daʼvo arizasini tuzish/ });
await dialog.waitFor({ timeout: 40000 });
await page.waitForTimeout(4000);
check('header says «Hujjatlar», not «Hujjatlar xonasi»', (await dialog.getByText('Hujjatlar · 2-bosqich').count()) === 1);
check('folder shows the papers from the consultation', (await page.getByText('Advokatlik shartnomasi (yuridik yordam').count()) === 1 && (await page.getByText('Mehnatga layoqatsizlik varaqasi').count()) === 1);
await page.screenshot({ path: `${OUT}/d1-folder.png` });

// the order (12 items of the official form)
await page.getByRole('tab', { name: 'Advokat orderi' }).click();
const fill = async (label, v) => page.getByLabel(label, { exact: false }).fill(v);
await fill('1. Order raqami', '1');
await fill('2. Advokatlik tuzilmasining nomi', '«Namuna» advokatlik byurosi');
await fill('3. Advokatlik tuzilmasining manzili', 'Namuna tumani, Mustaqillik koʻchasi, 3-uy, tel. +998 71 000-00-03');
await fill('4. Advokatning familiyasi', 'Karimova Aziza Rustam qizi');
await fill('5. Advokatlik guvohnomasining', 'AG-0147, 2024-yil 3-iyun, Advokatlar palatasi');
await page.getByRole('radio', { name: 'Fuqarolik va iqtisodiy sud ishlarini yuritish' }).check();
await page.getByRole('radio', { name: 'Shartnoma (bitim)' }).check();
await fill('8. Asos boʻlgan hujjat', '2026-yil 19-noyabr');
await fill('9. Ishonch bildiruvchi', 'Nurmatov Sardor Akmal oʻgʻli');
await page.getByLabel('10. Yuridik yordam').selectOption('civil');
await fill('11. Order berilgan sana', '2026-yil 20-noyabr');
await page.getByRole('checkbox', { name: /12\. Qogʻoz order/ }).check();
await page.screenshot({ path: `${OUT}/d2-order.png` });

// the claim
await page.getByRole('tab', { name: 'Daʼvo arizasi' }).click();
await page.getByLabel('Sud', { exact: true }).selectOption('civil');
await page.getByLabel('Hudud').selectOption('Namuna');
check('the court name is composed from the choice', (await page.getByText('Fuqarolik ishlari boʻyicha Namuna tumanlararo sudiga').count()) >= 1);
await fill('Daʼvogarning familiyasi', 'Nurmatov Sardor Akmal oʻgʻli');
await fill('Daʼvogarning yashash joyi', 'Namuna tumani, Bogʻbon mahallasi, 12-uy');
await fill('Vakilning familiyasi', 'Karimova Aziza Rustam qizi');
await fill('Vakilning manzili', '«Namuna» advokatlik byurosi, Namuna tumani, Mustaqillik koʻchasi, 3-uy');
await fill('Javobgar (tashkilot', '«Namuna Savdo» MChJ');
await fill('Joylashgan yeri', 'Namuna tumani, Ipak yoʻli koʻchasi, 5-uy');
await page.getByLabel('SOʻRAYMAN:').fill('1) daʼvogarni omborchi lavozimiga tiklashni;\n2) majburiy progul vaqti uchun oʻrtacha ish haqini undirishni.');
await page.getByLabel('Holatlar').fill('Daʼvogar 2026-yil 14-oktabrdagi 47-k-sonli buyruq bilan 9–10-oktabr kunlari uzrsiz ishda boʻlmagan deb ishdan boʻshatilgan. Undan yozma tushuntirish talab qilinmagan.\nAslida u kasal boʻlgan, 9-oktabr ertalab boshligʻiga telefon orqali xabar bergan, buni guvoh Bahodir R. tasdiqlaydi. 13-oktabr kuni kasallik varaqasi kadrlar boʻlimida qabul qilinmagan.');
for (const t of ['Boʻshatish buyrugʻi nusxasi', 'Mehnat shartnomasi', 'Kasallik varaqasi', 'Advokat orderi']) await page.getByRole('button', { name: new RegExp(t) }).first().click();
await page.getByLabel('Nizoni sudgacha').selectOption('none');
for (const t of ['Boʻshatish buyrugʻi nusxasi', 'Mehnat shartnomasi nusxasi', 'Kasallik varaqasi nusxasi', 'Advokat orderi \\(vakolat', 'Pochta xarajatlari']) await page.getByRole('checkbox', { name: new RegExp(t) }).check();
await page.getByRole('button', { name: 'Koʻpaytirish' }).click();
await page.getByLabel('Ariza sanasi').fill('2026-11-20');
const box = await page.getByLabel(/Imzo maydoni/).boundingBox();
await page.mouse.move(box.x + 30, box.y + 60); await page.mouse.down();
for (let i = 0; i < 18; i++) await page.mouse.move(box.x + 30 + i * 12, box.y + 50 + Math.sin(i) * 18);
await page.mouse.up();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/d3-claim.png` });
await page.getByRole('button', { name: /Qogʻozni yaqindan/ }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/d4-paper.png` });
await page.getByRole('button', { name: /Stolga qaytarish/ }).click();
await page.getByRole('button', { name: 'Chop etish va papkaga solish' }).click();
await page.waitForTimeout(2500);

// filing: the court rules on what was written
const ruling = await page.evaluate(async (caseId) => {
  const post = async (path, body) => (await fetch(`/api/v1/cases${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  let n = 0;
  const act = (b) => post(`/${caseId}/act`, { ...b, clientActionId: `qa-file-${Date.now()}-${++n}` });
  await act({ type: 'leave' });
  await act({ type: 'enter', stage: 'filing' });
  await act({ type: 'choose', optionId: 'purpose' });
  const s = await act({ type: 'choose', optionId: 'hand' });
  return s.case.rulings.at(-1);
}, id);
check('a correctly written claim is accepted (FPK 193)', ruling?.kind === 'accepted', ruling?.title);
console.log(logs.length ? `\nconsole:\n${[...new Set(logs)].join('\n')}` : '\nconsole: clean');
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
