/**
 * The papers of the case as physical things on the desk: what each one is,
 * how it looks (drawn on a canvas at print resolution) and where it lies.
 *
 * Every document is a fictional training sample and says so; no state
 * emblem, no real organisation's form.
 */
import type { CaseSnapshot, Ruling, StageId } from '@/contracts/case';

export type DocKind = 'sheet' | 'folder' | 'box';

export interface DeskDoc {
  id: string;
  kind: DocKind;
  /** Short name on hover / in the hand. */
  name: string;
  /** What it is for, one line. */
  note: string;
  /** Pages (sheet = 1, folder = its contents). Each page is drawn from lines. */
  pages: Page[];
  /** Cover / box colour. */
  color?: string;
}

export interface Page {
  head: string;
  title: string;
  lines: string[];
  /** Signature / stamp line at the foot. */
  foot?: string;
  stamp?: string;
}

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Draws one A4 page (w × w·√2). */
export function drawPage(ctx: CanvasRenderingContext2D, w: number, h: number, p: Page) {
  const u = w / 1000;
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.018)';
  for (let i = 0; i < 800; i++) ctx.fillRect((i * 7919) % w, (i * 104729) % h, 2 * u, u);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2a2a2a';
  ctx.font = `600 ${22 * u}px ${SANS}`;
  ctx.fillText(p.head, w / 2, 90 * u);
  ctx.fillRect(120 * u, 108 * u, w - 240 * u, 2 * u);
  ctx.font = `700 ${34 * u}px ${SERIF}`;
  ctx.fillStyle = '#141414';
  wrap(ctx, p.title, w - 200 * u).forEach((l, i) => ctx.fillText(l, w / 2, 180 * u + i * 42 * u));
  ctx.textAlign = 'left';
  ctx.font = `400 ${25 * u}px ${SERIF}`;
  let y = 290 * u;
  for (const para of p.lines) {
    for (const l of wrap(ctx, para, w - 200 * u)) {
      ctx.fillText(l, 100 * u, y);
      y += 36 * u;
    }
    y += 14 * u;
  }
  if (p.foot) {
    ctx.font = `400 ${24 * u}px ${SERIF}`;
    ctx.fillText(p.foot, 100 * u, h - 190 * u);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(w - 380 * u, h - 186 * u);
    ctx.lineTo(w - 100 * u, h - 186 * u);
    ctx.stroke();
    // a hand-written flourish for the signature
    ctx.strokeStyle = '#1a2b6d';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) ctx.lineTo(w - 360 * u + i * 10 * u, h - 205 * u + Math.sin(i * 0.9) * 14 * u - i * 0.6 * u);
    ctx.stroke();
  }
  if (p.stamp) {
    // round training stamp, not a real seal
    const cx = w - 250 * u, cy = h - 300 * u, r = 95 * u;
    ctx.strokeStyle = 'rgba(43,58,154,0.75)';
    ctx.lineWidth = 5 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(43,58,154,0.8)';
    ctx.textAlign = 'center';
    ctx.font = `700 ${20 * u}px ${SANS}`;
    ctx.fillText(p.stamp, cx, cy - 6 * u);
    ctx.font = `600 ${15 * u}px ${SANS}`;
    ctx.fillText('OʻQUV NAMUNASI', cx, cy + 22 * u);
    ctx.textAlign = 'left';
  }
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.045)';
  ctx.font = `800 ${90 * u}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('OʻQUV NAMUNASI', 0, 0);
  ctx.restore();
}

const ORDER: DeskDoc = {
  id: 'order', kind: 'sheet', name: 'Boʻshatish buyrugʻi (nusxa)', note: 'Mehnat shartnomasi bekor qilingani — sanasi va asosi shu yerda.',
  pages: [{ head: '«NAMUNA SAVDO» MChJ · Namuna tumani', title: 'BUYRUQ № 47-k  ·  2026-yil 14-oktabr', lines: [
    'Omborchi Sardor N. 2026-yil 9 va 10-oktabr kunlari uzrli sabablarsiz ishda boʻlmaganligi — mehnat majburiyatlarini bir marta qoʻpol ravishda buzganligi sababli u bilan tuzilgan mehnat shartnomasi 2026-yil 14-oktabrdan bekor qilinsin.',
    'Asos: boʻlim boshligʻining bildirgisi.',
    'Buyruq bilan tanishtirildi: ______________',
  ], foot: 'Direktor A. Karimov', stamp: 'NAMUNA SAVDO' }],
};
const CONTRACT: DeskDoc = {
  id: 'contract', kind: 'sheet', name: 'Mehnat shartnomasi', note: 'Lavozim, ish haqi, ish joyi — daʼvo talabi shunga tayanadi.',
  pages: [{ head: '«NAMUNA SAVDO» MChJ · Namuna tumani', title: 'MEHNAT SHARTNOMASI № 112', lines: [
    'Ish beruvchi «Namuna Savdo» MChJ va xodim Sardor N. mazkur shartnomani tuzdilar.',
    'Lavozim: omborchi. Ish joyi: markaziy ombor. Ish haqi: oyiga 4 200 000 soʻm.',
    'Shartnoma muddatsiz tuzildi. Ish vaqti: dushanba–juma, 9:00–18:00.',
  ], foot: 'Taraflar imzosi', stamp: 'NAMUNA SAVDO' }],
};
const SICKLEAVE: DeskDoc = {
  id: 'sickleave', kind: 'sheet', name: 'Mehnatga layoqatsizlik varaqasi', note: 'Kelmaslik sababi uzrli ekanining asosiy dalili. 2024-yildan faqat elektron shaklda beriladi — bu chop etilgan nusxasi.',
  pages: [{ head: 'Namuna tumani oilaviy poliklinikasi · elektron varaqa nusxasi', title: 'MEHNATGA LAYOQATSIZLIK VARAQASI', lines: [
    'Bemor: Sardor N.',
    'Vaqtincha mehnatga layoqatsizlik davri: 2026-yil 9-oktabr — 10-oktabr.',
    'Tashxis: oʻtkir respirator infeksiya (yuqori harorat).',
    'Ishga chiqish: 2026-yil 11-oktabr.',
  ], foot: 'Shifokor M. Yusupova', stamp: 'POLIKLINIKA' }],
};
const TALON: DeskDoc = {
  id: 'talon', kind: 'sheet', name: 'Ariza qabul qilingani haqida maʼlumot', note: 'Ariza roʻyxatga olinganini tasdiqlaydi; koʻrib chiqilishini shu raqam boʻyicha soʻrash mumkin (JPK 329: oʻn sutkagacha).',
  pages: [{ head: 'Namuna tumani ichki ishlar boʻlimi (IIB)', title: 'ARIZA QABUL QILINGANI HAQIDA MAʼLUMOT № 1834', lines: [
    'Arizachi: Nodira K.',
    'Ariza mazmuni: 2026-yil 19-noyabr kuni bozorda telefon oʻgʻirlangani toʻgʻrisida.',
    'Qabul qilindi va roʻyxatga olindi: 2026-yil 20-noyabr, 10:42.',
  ], foot: 'Navbatchi J. Sobirov', stamp: 'NAMUNA TUMANI IIB' }],
};
const PHONEBOX: DeskDoc = {
  id: 'phonebox', kind: 'box', name: 'Telefon qutisi va xarid cheki', note: 'IMEI raqami qutida va chekda bor — qidiruvda asosiy belgi.', color: '#1b1d22',
  pages: [{ head: '«Namuna Texno» doʻkoni · xarid cheki', title: 'CHEK № 00731', lines: [
    'Mahsulot: smartfon, qora rang, 128 GB.',
    'IMEI: 35 870 41 1093248 6 (oʻquv namunasi).',
    'Narxi: 3 400 000 soʻm. Sana: 2026-yil 2-mart.',
  ] }],
};

function rulingPage(r: Ruling, court: string): Page {
  return { head: court, title: r.title, lines: r.body.slice(0, 8), foot: r.kind === 'judgment' || r.kind === 'scheduled' || r.kind === 'accepted' || r.kind === 'returned' ? 'Sudya B. Islomov' : undefined, stamp: 'SUD' };
}

/**
 * What lies on the desk in this room, from what the case has produced so
 * far: the client's papers once handed over, the court's rulings, the
 * registration slip and the receipt in the theft case.
 */
export function deskDocs(snap: CaseSnapshot, stage: StageId): DeskDoc[] {
  const has = (id: string) => snap.evidence.some((e) => e.id === id);
  const docs: DeskDoc[] = [];
  if (snap.kind === 'labour') {
    const papers = [has('order') && ORDER, has('contract') && CONTRACT, has('sickleave') && SICKLEAVE].filter(Boolean) as DeskDoc[];
    if (stage === 'consult' || stage === 'draft') docs.push(...papers);
    if (stage === 'chamber' || stage === 'hearing') {
      const court = 'FUQAROLIK ISHLARI BOʻYICHA NAMUNA TUMANLARARO SUDI';
      docs.push({
        id: 'case-folder', kind: 'folder', name: 'Ish jildi', note: 'Daʼvo materiallari va sud ajrimlari — majlisda kerak boʻladigan hammasi.', color: '#2f5d8a',
        pages: [...papers.flatMap((d) => d.pages), ...snap.rulings.map((r) => rulingPage(r, court))],
      });
    }
  } else {
    if ((stage === 'report' || stage === 'interview') && snap.facts.some((f) => f.id === 'imei')) docs.push(PHONEBOX);
    if (snap.facts.some((f) => f.id === 'warned')) docs.push(TALON);
  }
  return docs;
}

/** Where things lie, per room: [x, y(top of surface), z] slots near your hands. */
export const DESK_SLOTS: Partial<Record<StageId, { top: number; slots: [number, number][]; bounds: [number, number, number, number]; facing?: number }>> = {
  consult: { top: 0.762, slots: [[-0.35, -0.95], [0, -0.98], [0.35, -0.95]], bounds: [-0.78, 0.78, -1.17, -0.42] },
  draft: { top: 0.762, slots: [[-0.42, 0.02], [0.45, 0.0], [-0.5, 0.25]], bounds: [-0.74, 0.74, -0.2, 0.45] },
  report: { top: 1.107, slots: [[0.25, 0.5], [-0.25, 0.5]], bounds: [-0.6, 0.6, 0.42, 0.76] },
  interview: { top: 0.787, slots: [[-0.55, 0.72], [-0.2, 0.7]], bounds: [-0.95, 0.95, 0.62, 1.0] },
  complaint: { top: 0.787, slots: [[-0.55, 0.72], [-0.2, 0.7]], bounds: [-0.95, 0.95, 0.62, 1.0] },
  chamber: { top: 0.787, slots: [[-0.5, 0.72]], bounds: [-0.95, 0.95, 0.62, 1.0] },
  // the claimant's table runs along the left wall; you face across the room (+x)
  hearing: { top: 0.768, slots: [[-3.72, -1.45]], bounds: [-3.92, -3.28, -2.1, -0.12], facing: Math.PI / 2 },
};
