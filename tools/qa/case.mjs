// QA: "Ish yoʻli" — all five rooms in order, plus starting straight in the courtroom. Usage: node tools/qa/case.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'qa-shots';
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on('console', (m) => m.type() === 'error' && logs.push(`[error] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const group = page.getByRole('group', { name: 'Javoblar' });
const until = async (loc = group) => { for (let i = 0; i < 40 && !(await loc.count()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(250); } await loc.first().waitFor({ timeout: 15000 }); };
const say = async (re) => { await until(); await group.getByRole('button', { name: re }).click(); await page.waitForTimeout(300); };
const ack = async () => { const b = page.getByRole('button', { name: 'Tanishdim' }); await until(b); await page.waitForTimeout(600); return b; };
const standBtn = () => page.getByRole('button', { name: /Oʻrnidan turish/ });
const stand = async () => { await until(page.getByRole('button', { name: /Oʻrnidan turish|Oʻtirish/ })); if (await standBtn().count()) await standBtn().click(); await page.waitForTimeout(400); };
const next = (re) => page.getByRole('dialog').getByRole('link', { name: re });
const reflect = async () => {
  await page.getByText('Oʻquv natijalari').first().waitFor({ timeout: 30000 });
  for (const [re, text] of [[/Nima boʻldi\?/, 'Asosiy qarorimni toʻgʻri qabul qildim.'], [/Nega\?/, 'Qaror kodeksning tegishli moddasiga tayandi.'], [/Endi nima\?/, 'Keyingi xonada dalillarni oldindan tayyorlayman.']]) await page.getByLabel(re).fill(text);
};

await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
const fresh = () => page.evaluate(async () => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"fresh":true}' })).json()).case.caseId);

// straight into the courtroom
let id = await fresh();
await page.goto(`${BASE}/ish/${id}/hearing`);
await page.waitForTimeout(6000);
await shot('j1-hearing-direct');

id = await fresh();
await page.goto(`${BASE}/ish/${id}/consult`);
await page.waitForTimeout(6000);
await until();
await shot('k1-office');
for (const re of [/Va alaykum/, /boshidan aytib/, /qanday hujjatlar/, /kim tasdiqlay/, /Ish beruvchingiz/, /yozma tushuntirish/, /qachon qoʻlingizga/, /shartnoma tuzamiz/, /olib qolaman/]) await say(re);
await reflect(); await until(next(/Hujjatlar/));
await shot('k2-consult-result');

await next(/Hujjatlar/).click();
await page.getByRole('dialog', { name: /Daʼvo arizasini tuzish/ }).waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
// the order (12 items of the official form), then the claim: the court chosen, the rest written
const fill = (label, v) => page.getByLabel(label, { exact: false }).fill(v);
await page.getByRole('tab', { name: 'Advokat orderi' }).click();
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
await page.getByRole('tab', { name: 'Daʼvo arizasi' }).click();
await page.getByLabel('Sud', { exact: true }).selectOption('civil');
await page.getByLabel('Hudud').selectOption('Namuna');
await fill('Daʼvogarning familiyasi', 'Nurmatov Sardor Akmal oʻgʻli');
await fill('Daʼvogarning yashash joyi', 'Namuna tumani, Bogʻbon mahallasi, 12-uy');
await fill('Vakilning familiyasi', 'Karimova Aziza Rustam qizi');
await fill('Vakilning manzili', '«Namuna» advokatlik byurosi, Namuna tumani, Mustaqillik koʻchasi, 3-uy');
await fill('Javobgar (tashkilot', '«Namuna Savdo» MChJ');
await fill('Joylashgan yeri', 'Namuna tumani, Ipak yoʻli koʻchasi, 5-uy');
await page.getByLabel('SOʻRAYMAN:').fill('1) daʼvogarni omborchi lavozimiga tiklashni;\n2) majburiy progul vaqti uchun oʻrtacha ish haqini undirishni.');
await page.getByLabel('Holatlar').fill('Daʼvogar 2026-yil 14-oktabrdagi 47-k-sonli buyruq bilan 9-10-oktabr kunlari uzrsiz ishda boʻlmagan deb boʻshatilgan. Undan yozma tushuntirish talab qilinmagan.\nAslida u kasal boʻlgan, 9-oktabr ertalab boshligʻiga telefon orqali xabar bergan, buni guvoh Bahodir R. tasdiqlaydi. 13-oktabr kuni kasallik varaqasi kadrlar boʻlimida qabul qilinmagan.');
for (const t of ['Boʻshatish buyrugʻi nusxasi', 'Mehnat shartnomasi', 'Kasallik varaqasi', 'Advokat orderi']) await page.getByRole('button', { name: new RegExp(t) }).first().click();
await page.getByLabel('Nizoni sudgacha').selectOption('none');
for (const t of ['Boʻshatish buyrugʻi nusxasi', 'Mehnat shartnomasi nusxasi', 'Kasallik varaqasi nusxasi', 'Advokat orderi \\(vakolat', 'Pochta xarajatlari']) await page.getByRole('checkbox', { name: new RegExp(t) }).check();
await page.getByRole('button', { name: 'Koʻpaytirish' }).click();
await page.getByLabel('Ariza sanasi').fill('2026-11-20');
const box = await page.getByLabel(/Imzo maydoni/).boundingBox();
await page.mouse.move(box.x + 30, box.y + 60); await page.mouse.down();
for (let i = 0; i < 18; i++) await page.mouse.move(box.x + 30 + i * 12, box.y + 50 + Math.sin(i) * 18);
await page.mouse.up();
await page.getByRole('button', { name: /Chop etish/ }).click();
await reflect(); await until(next(/Sud devonxonasi/));
await shot('k3-draft-result');

await next(/Sud devonxonasi/).click();
await page.waitForTimeout(5000);
await until();
await shot('k4-registry');
await say(/daʼvo arizasini topshirmoqchiman/);
await say(/papkasini uzatish/);
await (await ack()).click();
await reflect(); await until(next(/Sudya kabineti/));
await next(/Sudya kabineti/).click();
await page.waitForTimeout(5000);
await until();
await shot('k5-chamber');
for (const re of [/kasal boʻlgan\. Ishga tiklashni/, /guvoh Bahodir R\.ni/, /mijozim bilan maslahatlashdik/]) await say(re);
await (await ack()).click();
await reflect(); await until(next(/Sud majlisi zali/));
await next(/Sud majlisi zali/).click();
await page.waitForTimeout(5000);
await until(standBtn());
await shot('k6-hall-rise');
await standBtn().click();
const sit = page.getByRole('button', { name: /Oʻtirish/ });
await until(sit); await page.waitForTimeout(800); await sit.click();
await until();
await shot('k7-hall-question');
for (const re of [/arizamiz yoʻq/, /kasallik varaqasi bor va/, /varaqadagi sanalarga/, /nima boʻlganini aytib bering/, /ishga tiklashingizni soʻrayman/]) { await stand(); await say(re); }
// the court retires (rise), deliberates (sit), returns with the judgment (rise)
await stand();
await until(sit); await sit.click();
await stand();
await (await ack()).click();
await page.getByRole('dialog', { name: /natija/ }).waitFor({ timeout: 30000 });
await shot('k8-hearing-result');
console.log(logs.join('\n') || 'no console errors');
await browser.close();
