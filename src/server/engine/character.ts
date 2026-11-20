/**
 * Character agent — plays the citizen and nothing else.
 *
 * It receives a deliberately restricted context: persona, the facts the
 * engine has ALREADY unlocked this turn, the current mood and a "beat"
 * chosen by the engine. It never sees the ideal path, the rubric, locked
 * facts or the score, so it cannot leak them.
 *
 * `ScriptedCharacterAgent` is deterministic (seeded) and works offline; the
 * UI labels it as a scripted demo. A model-backed agent implements the same
 * interface and receives the same restricted context.
 */
import type { Emotion, Gesture } from '@/contracts';
import type { HiddenFact } from '../scenarios/dxm-yoqolgan-staj';

export type Beat =
  | 'injection'
  | 'bribe-refused'
  | 'bribe-accepted'
  | 'bribe-pushed'
  | 'bribe-dropped'
  | 'rude'
  | 'dismissed'
  | 'reveal'
  | 'already-told'
  | 'evasive'
  | 'service-explained'
  | 'steps-explained'
  | 'jargon'
  | 'overpromise'
  | 'warm'
  | 'fallback'
  | 'leaving';

export interface CharacterContext {
  beat: Beat;
  revealed: HiddenFact[];
  emotion: Emotion;
  patience: number;
  trust: number;
  knowsDeadline: boolean;
  knowsDocuments: boolean;
  /** Seeded RNG in [0, 1). */
  rand: () => number;
}

export interface CharacterReply {
  text: string;
  gesture: Gesture;
}

export interface CharacterAgent {
  readonly kind: 'scripted' | 'llm';
  reply(ctx: CharacterContext, userText: string): Promise<CharacterReply>;
}

const LINES: Record<Exclude<Beat, 'reveal'>, { text: string[]; gesture: Gesture }> = {
  injection: {
    text: [
      'Ukam, nima deyapsiz, tushunmadim. Men nafaqam masalasida kelganman.',
      'Bu gaplaringizga aqlim yetmadi. Mening ishimga qarab bering, iltimos.',
    ],
    gesture: 'shake-head',
  },
  'bribe-refused': {
    text: [
      'Uzr, ukam… odat boʻlib qolgan-da. Hamma joyda shunday qilishadi deb oʻylabman. Mayli, tartibi bilan boʻlsa, yana yaxshi.',
      'E, kechirasiz. Yomon niyatda emasdim. Demak, shundoq ham qilib berasizmi? Rahmat.',
    ],
    gesture: 'withdraw-envelope',
  },
  'bribe-accepted': {
    text: ['Ha, barakalla! Ana endi ish bitadi. Faqat tezroq boʻlsin-da.'],
    gesture: 'nod',
  },
  'bribe-pushed': { text: [], gesture: 'offer-envelope' },
  'bribe-dropped': {
    text: ['Mayli, oʻzingiz bilasiz…', 'Xoʻp, xoʻp. Majburlamayman.'],
    gesture: 'withdraw-envelope',
  },
  rude: {
    text: [
      'Nega bunday gapirasiz? Men sizdan katta odamman! Shuning uchun ham bu idoralarga kelgim kelmaydi.',
      'Voy-boʻ, muomalangizni qarang. Shikoyat yozaman hali!',
    ],
    gesture: 'shake-head',
  },
  dismissed: {
    text: [
      'Yana oʻsha gap! Hamma “bizda emas” deydi. Unda men qayerga boray, ayting?!',
      'Bilgandim… Yana eshikdan qaytarasizlarmi? Yoshim oltmishdan oshgan, qatnashga holim yoʻq.',
    ],
    gesture: 'sigh',
  },
  'already-told': {
    text: ['Buni aytdim-ku, ukam. Diqqat qilib eshiting-da.', 'Hozirgina aytdim-ku buni…'],
    gesture: 'sigh',
  },
  evasive: {
    text: [
      'Sizga aytib nima foyda… Baribir hech kim yordam bermaydi.',
      'Aytsam nima oʻzgaradi? Avval nafaqamni toʻgʻrilab beringlar.',
    ],
    gesture: 'shake-head',
  },
  'service-explained': {
    text: [
      'Demak, arxivdan soʻrab olsa boʻlarkan-da? Buni menga hech kim aytmagan edi. Qancha vaqt oladi bu?',
      'Ha-a, endi tushundim. Arxivdan tasdiqlab kelishsa, stajga qoʻshilar ekan-da. Mendan nima kerak boʻladi?',
    ],
    gesture: 'lean-in',
  },
  'steps-explained': {
    text: [
      'Yaxshi, yozib oldim. Shunday aniq aytsangiz, odam xotirjam boʻladi.',
      'Tushunarli. Demak, kutaman. Rahmat, ukam, hech kim bunday tushuntirmagan edi.',
    ],
    gesture: 'nod',
  },
  jargon: {
    text: [
      'Ukam, men oddiy odamman, bu soʻzlaringizni tushunmadim. Soddaroq qilib ayting.',
      'Shoshmang… nima dedingiz? Kitobiy gapirmasdan, tushuntirib bering.',
    ],
    gesture: 'shake-head',
  },
  overpromise: {
    text: [
      'Rostdanmi? Bugunoq-a? Avvalgilar ham shunday deb, keyin yoʻq boʻlib ketishgan…',
      'Aniq oshadimi? Soʻzingizda turasizmi? Aldab qoʻymang-da.',
    ],
    gesture: 'lean-in',
  },
  warm: {
    text: [
      'Rahmat, ukam. Hech boʻlmasa eshitadigan odam bor ekan. Nafaqam oʻylaganimdan ancha kam chiqdi, shuni koʻrib bering.',
      'Ha, mayli… Gap shundaki, nafaqa tayinlashdi, lekin juda kam. Qirq yil ishlagan odamga shu toʻgʻrimi?',
    ],
    gesture: 'nod',
  },
  fallback: {
    text: [
      'Bilmasam, ukam… Men faqat nafaqam kam chiqqanini bilaman. Nimadan boshlashni oʻzingiz ayting.',
      'Men tushunmayman bu ishlarni. Nafaqamni toʻgʻrilab bersangiz boʻldi.',
      'Xoʻsh, endi nima qilamiz? Vaqtim ham ziq, uyga yetib olishim kerak.',
    ],
    gesture: 'check-watch',
  },
  leaving: {
    text: [
      'Boʻldi, yetar! Bu yerda ham ish bitmas ekan. Rahbaringizga shikoyat yozaman!',
    ],
    gesture: 'stand',
  },
};

const pick = <T,>(items: T[], rand: () => number): T => items[Math.floor(rand() * items.length)];

export class ScriptedCharacterAgent implements CharacterAgent {
  readonly kind = 'scripted' as const;

  async reply(ctx: CharacterContext): Promise<CharacterReply> {
    if (ctx.beat === 'reveal') {
      const text = ctx.revealed.map((f) => pick(f.lines, ctx.rand)).join(' ');
      const gesture = ctx.revealed.find((f) => f.gesture)?.gesture ?? 'nod';
      return { text, gesture };
    }
    if (ctx.beat === 'service-explained') {
      // Ask for whatever the student has not explained yet — never volunteer it.
      const options = LINES['service-explained'].text;
      const text = ctx.knowsDeadline ? options[1] : options[0];
      return { text: ctx.knowsDeadline && ctx.knowsDocuments ? LINES['steps-explained'].text[0] : text, gesture: 'lean-in' };
    }
    const entry = LINES[ctx.beat];
    return { text: pick(entry.text, ctx.rand), gesture: entry.gesture };
  }
}
