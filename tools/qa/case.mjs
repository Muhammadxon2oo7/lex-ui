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
await until(next(/Hujjatlar xonasi/));
await shot('k2-consult-result');

await next(/Hujjatlar xonasi/).click();
await page.getByRole('dialog', { name: /Daʼvo arizasini tuzish/ }).waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
await page.getByRole('radio', { name: /Fuqarolik ishlari boʻyicha Namuna tumanlararo/ }).click();
await page.getByRole('checkbox', { name: /Vakil maʼlumotlarini/ }).check();
await page.getByRole('radio', { name: /Namuna Savdo» MChJ \(ish beruvchi/ }).click();
await page.getByRole('radio', { name: /Ishga tiklash va majburiy/ }).click();
for (const t of ['Javobgar: «Namuna', 'Boʻshatish buyrugʻi 14', 'Yozma tushuntirish', 'kasal boʻlgan', 'telefonda xabar', 'varaqani qabul qilmagan', 'Guvoh:']) await page.getByRole('button', { name: new RegExp(t) }).click();
for (const t of ['Boʻshatish buyrugʻi nusxasi', 'Kasallik varaqasi', 'Advokat orderi']) await page.getByRole('button', { name: new RegExp(t) }).first().click();
for (const t of ['Boʻshatish buyrugʻi nusxasi', 'Mehnat shartnomasi nusxasi', 'Kasallik varaqasi nusxasi', 'Advokat orderi', 'Pochta xarajatlari']) await page.getByRole('checkbox', { name: new RegExp(t) }).check();
await page.getByRole('checkbox', { name: /Elektron manzilni/ }).check();
await page.getByRole('button', { name: 'Koʻpaytirish' }).click();
const box = await page.getByLabel(/Imzo maydoni/).boundingBox();
await page.mouse.move(box.x + 30, box.y + 60); await page.mouse.down();
for (let i = 0; i < 18; i++) await page.mouse.move(box.x + 30 + i * 12, box.y + 50 + Math.sin(i) * 18);
await page.mouse.up();
await page.getByRole('button', { name: /Chop etish/ }).click();
await until(next(/Sud devonxonasi/));
await shot('k3-draft-result');

await next(/Sud devonxonasi/).click();
await page.waitForTimeout(5000);
await until();
await shot('k4-registry');
await say(/daʼvo arizasini topshirmoqchiman/);
await say(/papkasini uzatish/);
await (await ack()).click();
await until(next(/Sudya kabineti/));
await next(/Sudya kabineti/).click();
await page.waitForTimeout(5000);
await until();
await shot('k5-chamber');
for (const re of [/kasal boʻlgan\. Ishga tiklashni/, /guvoh Bahodir R\.ni/, /mijozim bilan maslahatlashdik/]) await say(re);
await (await ack()).click();
await until(next(/Sud majlisi zali/));
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
