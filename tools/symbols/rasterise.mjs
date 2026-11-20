/**
 * Rasterises the official State symbols into the textures the 3D rooms use.
 *
 *   node tools/symbols/rasterise.mjs
 *
 * Sources (Wikimedia Commons, public domain as official State symbols —
 * drawn after the images annexed to the laws):
 *   Flag_of_Uzbekistan.svg    — Law of 18.11.1991 No. 407-XII (lex.uz/docs/-100122)
 *   Emblem_of_Uzbekistan.svg  — Law of 02.07.1992 No. 616-XII (lex.uz/docs/-17260)
 *
 * Never edit the outputs by hand and never redraw the symbols procedurally.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.resolve(here, '../../public/assets/symbols');
fs.mkdirSync(out, { recursive: true });

const jobs = [
  { svg: 'Flag_of_Uzbekistan.svg', png: 'flag.png', w: 2048, h: 1024 },
  // 134.869 × 137.221 mm drawing
  { svg: 'Emblem_of_Uzbekistan.svg', png: 'emblem.png', w: 1006, h: 1024 },
];

const browser = await chromium.launch();
for (const j of jobs) {
  const svg = fs.readFileSync(path.join(here, j.svg));
  const page = await browser.newPage({ viewport: { width: j.w, height: j.h } });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img style="display:block;width:${j.w}px;height:${j.h}px" src="data:image/svg+xml;base64,${svg.toString('base64')}"></body></html>`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, j.png), omitBackground: true });
  await page.close();
  console.log('✓', j.png);
}
await browser.close();
