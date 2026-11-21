// QA: "Ish yoʻli 2" - theft report through four rooms, the last one a criminal trial (JPK 424-473).
// Each result asks for the three-part reflection before the next room opens. Usage: node tools/qa/theft.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'qa-shots';
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
page.on('console', (m) => m.type() === 'error' && logs.push(`[error] ${m.text().slice(0, 200)}`));
const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const group = page.getByRole('group', { name: 'Javoblar' });
const until = async (loc = group) => { for (let i = 0; i < 40 && !(await loc.count()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(250); } await loc.first().waitFor({ timeout: 15000 }); };
const say = async (re) => { await until(); await group.getByRole('button', { name: re }).click(); await page.waitForTimeout(300); };
const next = (re) => page.getByRole('dialog').getByRole('link', { name: re });
// the three-part reflection (What? So what? Now what?) opens the way to the next room
const reflect = async () => {
  await page.getByText('Oʻquv natijalari').first().waitFor({ timeout: 30000 });
  for (const [re, text] of [[/Nima boʻldi\?/, 'Asosiy qarorimni toʻgʻri qabul qildim.'], [/Nega\?/, 'Qaror kodeksning tegishli moddasiga tayandi.'], [/Endi nima\?/, 'Keyingi xonada ham huquqlarni avval talab qilaman.']]) await page.getByLabel(re).fill(text);
};
// in court: stand when the hall rises, sit when allowed, stand before speaking (JPK 424)
const standBtn = () => page.getByRole('button', { name: /Oʻrnidan turish/ });
const court = async (re) => {
  for (let i = 0; i < 80; i++) {
    const want = group.getByRole('button', { name: re });
    if (await want.count()) {
      if (await standBtn().count()) { await page.keyboard.press('KeyG'); await page.waitForTimeout(500); }
      await want.click(); await page.waitForTimeout(400); return;
    }
    if (await page.getByText(/siz ham turing/).count()) await page.keyboard.press('KeyG');
    else if (await page.getByText(/Endi oʻtirishingiz mumkin/).count()) await page.keyboard.press('KeyG');
    else await page.keyboard.press('Space');
    await page.waitForTimeout(300);
  }
  throw new Error('not offered in court: ' + re);
};

await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem('lexsim.profile.v1', JSON.stringify({ name: 'Karimova Aziza', avatar: 'woman', role: 'student' })));
const id = await page.evaluate(async () => (await (await fetch('/api/v1/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"fresh":true,"kind":"theft"}' })).json()).case.caseId);
await page.goto(`${BASE}/ish/${id}/report`);
await page.waitForTimeout(4000); await shot('t1-desk-arrive');
await page.waitForTimeout(3000); await until(); await shot('t2-desk');
for (const re of [/jinoyat toʻgʻrisida ariza bermoqchimiz/, /Yozma ariza tayyor/, /ogohlantirishni tushuntirib/, /IMEI raqami bor/]) await say(re);
await reflect(); await until(next(/Tergovchi kabineti/)); await shot('t3-desk-result');
await next(/Tergovchi kabineti/).click();
await page.waitForTimeout(6000); await until(); await shot('t4-investigator');
for (const re of [/huquq va majburiyatlarini tushuntirishingizni/, /qiyofasini/, /bayonnomani oʻqib chiqamiz/]) await say(re);
await reflect(); await until(next(/Tergov boʻlinmasi/)); await shot('t5-interview-result');
await next(/Tergov boʻlinmasi/).click();
await page.waitForTimeout(6000); await until(); await shot('t6-chief');
await say(/harakatsizligi ustidan shikoyat qilamiz/);
await page.getByRole('dialog', { name: /natija/ }).waitFor({ timeout: 30000 }); await shot('t7-result');
await reflect(); await next(/Jinoyat ishlari/).click();
await page.waitForTimeout(9000); await shot('t8-trial');
for (const re of [/rad qilish toʻgʻrisida arzimiz yoʻq/, /huquqlar tushunarli/, /kamera/, /avval sudlanuvchini/, /SIM-kartangizni/, /eʼtiroz bildiraman/, /qanday masofadan/, /toʻldirishimiz yoʻq/, /ayblovni tasdiqlaydi/]) await court(re);
await court(/Oxirgi soʻzni jim tinglash/);
for (let i = 0; i < 60 && !(await page.getByRole('dialog', { name: /natija/ }).count()); i++) {
  if (await page.getByText(/siz ham turing|Endi oʻtirishingiz mumkin/).count()) await page.keyboard.press('KeyG'); else await page.keyboard.press('Space');
  await page.waitForTimeout(350);
}
await page.getByRole('dialog', { name: /natija/ }).waitFor({ timeout: 30000 });
const verdict = await page.getByRole('dialog', { name: /natija/ }).innerText();
console.log(/Ayblov hukmi/.test(verdict) ? 'PASS  trial: guilty verdict on evidence examined at trial' : 'FAIL  trial verdict: ' + verdict.slice(0, 120));
await shot('t9-trial-result');
await page.goto(`${BASE}/kampus`);
await page.getByRole('heading', { name: /Nodira K\./ }).waitFor({ timeout: 60000 });
await page.waitForTimeout(2500); await shot('t10-kiosk');
console.log(logs.join('\n') || 'no console errors');
await browser.close();
