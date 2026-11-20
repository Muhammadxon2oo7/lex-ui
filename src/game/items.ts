/**
 * Things a front-desk official actually handles. Each can be picked up,
 * turned in the hand and — where it makes sense — used.
 *
 * The notes are working habits, not statements of law: nothing here cites
 * a norm, so nothing here needs a source.
 */
import type { Snapshot } from '@/contracts';

export type ItemId = 'stamp' | 'id-card' | 'code-book' | 'case-folder' | 'queue-ticket' | 'receipt';

export interface ItemDef {
  id: ItemId;
  name: string;
  kind: string;
  purpose: string;
  practice: string[];
  /** Largest dimension in metres (used to frame it in the hand). */
  size: number;
  action?: { label: string; again?: string };
  /** Omitted → always on hand. */
  available?: (s: Snapshot) => boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  stamp: {
    id: 'stamp',
    name: 'Muhr',
    kind: 'Ish quroli',
    purpose: 'Hujjat markaz nomidan rasmiylashtirilganini tasdiqlaydi.',
    practice: [
      'Muhr faqat imzodan keyin va matn toʻliq tekshirilgach bosiladi.',
      'Boʻsh yoki toʻldirilmagan varaqqa hech qachon bosilmaydi.',
      'Ish kuni oxirida qulflanadigan joyga qoʻyiladi — begona qoʻlga berilmaydi.',
    ],
    size: 0.12,
    action: { label: 'Muhr bosish', again: 'Yana bosish' },
  },
  'id-card': {
    id: 'id-card',
    name: 'ID-karta (oʻquv namunasi)',
    kind: 'Fuqaro hujjati',
    purpose: 'Murojaatchining shaxsini tasdiqlaydi. Orqa tomonidagi chip va mashina oʻqiydigan qator skaner orqali tizimga oʻqiladi; JShShIR shu yerda.',
    practice: [
      'Suratni roʻparangizdagi odam bilan solishtiring.',
      'Amal qilish muddatiga va old-orqa tomoniga qarang.',
      'Ish tugagach hujjat darhol egasiga qaytariladi.',
    ],
    size: 0.09,
    available: (s) => s.turns.length > 0,
  },
  'code-book': {
    id: 'code-book',
    name: 'Normativ hujjatlar toʻplami',
    kind: 'Maʼlumotnoma',
    purpose: 'Ish jarayonida tayaniladigan qonun hujjatlari. Shubha tugʻilsa — xotiraga emas, matnga qaraladi.',
    practice: [
      'Bosma nusxa eskirishi mumkin: amaldagi tahrir lex.uz saytidan tekshiriladi.',
      'Fuqaroga javob berishdan oldin normani oʻqib oling.',
    ],
    size: 0.22,
    action: { label: 'Ochish', again: 'Yopish' },
  },
  'case-folder': {
    id: 'case-folder',
    name: 'Ish yuritish jildi',
    kind: 'Hujjatlar',
    purpose: 'Murojaat boʻyicha qogʻoz hujjatlar shu jildda yuritiladi va tartib bilan tikiladi.',
    practice: [
      'Har bir varaq sanasi va tartib raqami bilan qoʻshiladi.',
      'Jild stolda ochiq qoldirilmaydi — unda shaxsga doir maʼlumot bor.',
    ],
    size: 0.32,
    action: { label: 'Ochish', again: 'Yopish' },
  },
  'queue-ticket': {
    id: 'queue-ticket',
    name: 'Navbat chiptasi',
    kind: 'Elektron navbat',
    purpose: 'Fuqaro kioskdan oladi; raqam ekranda chiqqach tegishli xonaga kiradi.',
    practice: ['Raqam boʻyicha chaqiring — navbatsiz qabul norozilik tugʻdiradi.'],
    size: 0.09,
  },
  receipt: {
    id: 'receipt',
    name: 'Tilxat',
    kind: 'Chiqish hujjati',
    purpose: 'Murojaat qabul qilinganini tasdiqlaydi; fuqaro natijani shu raqam boʻyicha kuzatadi.',
    practice: ['Fuqaroga berishdan oldin raqam va xizmat nomini oʻqib bering.'],
    size: 0.2,
    available: (s) => s.objects.receipt === 'active',
  },
};

export const availableItems = (s: Snapshot): ItemDef[] => Object.values(ITEMS).filter((i) => !i.available || i.available(s));
