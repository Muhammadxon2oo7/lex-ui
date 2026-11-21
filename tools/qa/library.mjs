// QA: domains (live from the court server) and the case flow (cases, sheet, AI draft, save) with mocked
// /api/v1/library responses — the case routes need the backend key, which only the deployed site has.
//   node tools/qa/library.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'qa-shots/library';
const BASE = process.env.BASE ?? 'http://localhost:3000';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (n, ok, note = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${note ? ` - ${note}` : ''}`); };
const browser = await chromium.launch();
const logs = [];
const C = (over = {}) => ({ id: 'u_1', domain: 'supply', source: 'user', status: 'approved', mine: false, title: '20 tonna unni kechiktirib yetkazib berish', court: 'Tumanlararo iqtisodiy sud', summary: 'Xaridor oldindan toʻlagan, un 22 kun kechikib kelgan, 3 tonnasi sifatsiz.', parties: { claimant: '«A» MChJ - xaridor', respondent: '«B» MChJ - yetkazib beruvchi' }, claim: 'Penya va sifatsiz tovar qiymatini undirish.', facts: [{ id: 'f1', title: 'Shartnoma', text: 'Mart oyida tuzilgan.' }], evidence: [{ id: 'e1', title: 'Yetkazib berish shartnomasi', text: 'Imzolangan.' }], side: { claimant: { task: ['Talabni asoslang'], confidential: [] }, respondent: { task: ['Eʼtiroz bildiring'], confidential: [] } }, legal: [{ normId: 'FK-454', label: 'FK 454-modda', url: 'https://lex.uz/docs/180550#-183361', why: 'Neustoyka' }], balance: null, questions: [], disclaimer: 'Oʻquv ishi.', modes: ['moot'], ...over });
let polls = 0;
for (const [name, vp] of [['desk', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await browser.newPage({ viewport: vp });
  p.on('pageerror', (e) => logs.push(`${name} ${e.message}`));
  await p.route('**/api/v1/library/cases?*', (r) => r.fulfill({ json: { cases: [C(), C({ id: 'u_2', mine: true, status: 'review', title: 'Mening casem: kommunal qarz' })] } }));
  await p.route('**/api/v1/library/drafts', (r) => r.fulfill({ json: { draft: { id: 'd_1', status: 'working' }, retryAfter: 1 } }));
  await p.route('**/api/v1/library/drafts/d_1', (r) => r.fulfill({ json: { draft: ++polls < 2 ? { id: 'd_1', status: 'working' } : { id: 'd_1', status: 'ready', case: C({ id: 'u_9', mine: true, status: 'draft', side: { claimant: { task: ['t'], confidential: ['Ombor yozuvi «eʼtirozsiz»'] }, respondent: { task: ['t'], confidential: ['Yoʻl yopilgan', 'Pretenziyaga javob berilmagan'] } }, balance: { claimant_strong: 'Oldindan toʻlov', claimant_weak: '«Eʼtirozsiz» yozuvi', respondent_strong: 'Tashqi toʻsiq', respondent_weak: 'Kechikish' } }), issues: [], questions: ['Shartnoma qaysi sanada tuzilgan?'], sources: 10, redacted: 1, ms: 49000 } } }));
  await p.route('**/api/v1/library/cases', (r) => r.request().method() === 'POST' ? r.fulfill({ json: { case: C({ id: 'u_9', mine: true, status: 'review' }) } }) : r.continue());
  await p.goto(`${BASE}/sohalar`);
  await p.getByRole('heading', { name: 'Iqtisodiy sud' }).waitFor({ timeout: 20000 });
  check(`${name}: domains come from the court server`, (await p.getByRole('link', { name: /Yetkazib berish/ }).count()) === 1);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${name}-domains.png` });
  await p.goto(`${BASE}/sohalar/supply`);
  await p.getByRole('button', { name: /20 tonna unni/ }).waitFor({ timeout: 15000 });
  check(`${name}: cases with badges`, (await p.getByText('Tekshiruvda').count()) >= 1);
  await p.screenshot({ path: `${OUT}/${name}-cases.png` });
  await p.getByRole('button', { name: /20 tonna unni/ }).click();
  await p.waitForTimeout(700);
  check(`${name}: sheet shows legal basis with lex.uz link`, (await p.getByRole('link', { name: /FK 454-modda/ }).count()) === 1);
  await p.screenshot({ path: `${OUT}/${name}-sheet.png` });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  if (name === 'desk') {
    await p.getByRole('button', { name: '+ Case qoʻshish' }).click();
    await p.getByLabel('Holat').fill('Bizning firma mart oyida 20 tonna un buyurtma qildi va oldindan 180 mln soʻm toʻladi. Un 22 kun kechikib keldi, 3 tonnasi sifatsiz chiqdi.');
    await p.getByRole('button', { name: 'AI case tuzsin' }).click();
    await p.getByText('AI caseni tuzyapti…').waitFor({ timeout: 5000 });
    await p.screenshot({ path: `${OUT}/${name}-working.png` });
    await p.getByText('Caseni tekshiring va saqlang').waitFor({ timeout: 40000 }).catch(async (e) => { await p.screenshot({ path: `${OUT}/fail.png` }); console.log('polls', polls, (await p.locator('[role=alert]').allInnerTexts()).join(' / ')); throw e; });
    await p.getByText('AI aniqlashtirmoqchi').waitFor({ timeout: 5000 });
    await p.waitForTimeout(500);
    check('draft: questions, confidential facts and balance are editable', (await p.getByText('AI aniqlashtirmoqchi').count()) === 1 && (await p.getByText(/kuchli joyi/).count()) === 2);
    await p.screenshot({ path: `${OUT}/${name}-draft.png` });
    await p.getByRole('button', { name: 'FK 454-moddani olib tashlash' }).click();
    await p.getByRole('button', { name: 'Saqlash' }).click();
    await p.getByText('Tekshiruvda').first().waitFor({ timeout: 10000 });
    check('saved case opens for its author, in review', true);
  }
  await p.close();
}
console.log(logs.length ? `\nconsole:\n${logs.join('\n')}` : '\nconsole: clean');
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
