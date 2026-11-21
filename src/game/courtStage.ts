/**
 * The stage of a court case: who sits in the hall and what lies on each table.
 *
 * Ten cases are ten different processes — a lease is argued over a contract and
 * signed invoices, a building contract over an acceptance act and an estimate,
 * an insurance claim over a policy and an assessor's report. The hall is the
 * same; the cast and the papers are not.
 *
 * Source of truth, in order:
 *   1. `scenario.scene` sent by the court server (its scenario pack knows the facts);
 *   2. otherwise a preset chosen by the kind of case (title / id keywords).
 *
 * Presets never invent facts: only the lease case (whose facts the server has
 * published) carries numbers and dates; the others show what each paper IS,
 * not figures that could contradict the scenario. Every paper is a fictional
 * training sample and says so (see documents.ts).
 */
import type { DeskDoc, Page } from '@/components/case/documents';
import { female, type CharacterModel } from '@/components/world/Character';

export type Side = 'claimant' | 'respondent';
/** Who speaks in the hall (the court server's npcTurn roles). */
export type VoiceRole = 'judge' | 'secretary' | 'opponent' | 'witness' | 'expert';

export interface CourtStage {
  /** Short kind of case, shown on the hall screen. */
  kind: string;
  /** Who sits beside you (your principal) and across (the other side's lawyer); a witness or expert if the case has one. */
  cast: { principal: CharacterModel | null; opponent: CharacterModel; witness?: CharacterModel };
  /** Papers on each side's table, by side (they are swapped onto "your" table by role). */
  papers: Record<Side, DeskDoc[]>;
  /** The voice of each speaking role: it always matches the body you see (a woman lawyer never speaks in a man's voice). */
  voices: Record<VoiceRole, string>;
}

/**
 * Voices from the cast. The court server has four voices today; a scenario may name its own
 * (scene.voices) once the server's palette grows — then two cases never sound alike.
 */
function voicesFor(cast: CourtStage['cast']): CourtStage['voices'] {
  const opp = female(cast.opponent) ? 'female_alt' : 'male';
  const wit = cast.witness && female(cast.witness) ? 'female' : 'male';
  return { judge: 'elder_m', secretary: 'female', opponent: opp, witness: wit, expert: wit };
}

const SAMPLE = 'Oʻquv namunasi · haqiqiy hujjat emas';
const page = (head: string, title: string, lines: string[], foot?: string, stamp?: string): Page => ({ head, title, lines, foot: foot ?? SAMPLE, stamp });
const sheet = (id: string, name: string, note: string, p: Page): DeskDoc => ({ id, kind: 'sheet', name, note, pages: [p] });
const folder = (id: string, name: string, note: string, pages: Page[], color = '#2f5d8a'): DeskDoc => ({ id, kind: 'folder', name, note, pages, color });

/** The materials every side brings: its own procedural papers. */
const claimCopy = (subject: string) => sheet('claim', 'Daʼvo arizasi (nusxa)', 'Talab va uning asoslari — majlisda shunga tayanasiz.', page('Iqtisodiy sudga', 'DAʼVO ARIZASI', [`Nizo predmeti: ${subject}.`, 'Talab, uning asoslari va dalillar roʻyxati ilova qilingan.'], 'Daʼvogar vakili imzosi'));
const responseCopy = (subject: string) => sheet('response', 'Daʼvo arizasiga fikr (nusxa)', 'Javobgarning eʼtirozlari va ularning asoslari.', page('Iqtisodiy sudga', 'DAʼVO ARIZASIGA FIKR (EʼTIROZ)', [`Nizo predmeti: ${subject}.`, 'Javobgarning eʼtirozlari va ularni tasdiqlovchi dalillar.'], 'Javobgar vakili imzosi'));
const power = sheet('power', 'Ishonchnoma', 'Vakolatingiz shu hujjat bilan tasdiqlanadi — majlis boshida soʻraladi.', page('Tashkilot rahbari tomonidan', 'ISHONCHNOMA', ['Vakilga sudda ish yuritish vakolati beriladi.', 'Muddati va vakolat doirasi koʻrsatilgan.'], 'Rahbar imzosi, muhr'));

/** A preset: the subject in words and the papers that prove it, by side. */
function preset(kind: string, subject: string, cast: CourtStage['cast'], claimant: DeskDoc[], respondent: DeskDoc[]): CourtStage {
  return { kind, cast, papers: { claimant: [power, claimCopy(subject), ...claimant], respondent: [power, responseCopy(subject), ...respondent] }, voices: voicesFor(cast) };
}

const PRESETS: { match: RegExp; stage: () => CourtStage }[] = [
  {
    // the published case: facts from the court server's scenario (contract 32-P of 1 April 2022, signed invoices, penalty clause 8.5)
    match: /ijara/i,
    stage: () => preset('Ijara qarzi va penya', 'ijara haqi qarzi va penya', { principal: 'client', opponent: 'lawyer' },
      [
        sheet('lease', 'Ijara shartnomasi № 32-P', 'Ijara haqi va penya sharti (8.5-band) shu shartnomada.', page('«A» MChJ va YaTT «B»', 'IJARA SHARTNOMASI № 32-P', ['Sana: 2022-yil 1-aprel.', 'Ijaraga beruvchi: «A» MChJ.', 'Ijarachi: yakka tartibdagi tadbirkor «B».', 'Ijara haqi va toʻlash tartibi — 4-boʻlim.', 'Penya — 8.5-band.'], 'Taraflar imzolari')),
        folder('invoices', 'Hisob-fakturalar (imzolangan)', 'Ijarachi imzolagan hisob-fakturalar: obyektdan foydalanilganini koʻrsatadi.', [page('«A» MChJ', 'HISOB-FAKTURALAR', ['Ijara xizmati uchun oylik hisob-fakturalar.', 'Ijarachi tomonidan imzolangan.'])], '#7a5a2f'),
      ],
      [sheet('lease', 'Ijara shartnomasi № 32-P (nusxa)', 'Topshirish tartibi va penya sharti — eʼtirozlaringiz shunga tayanadi.', page('«A» MChJ va YaTT «B»', 'IJARA SHARTNOMASI № 32-P', ['Sana: 2022-yil 1-aprel.', 'Obyektni topshirish tartibi — 2-boʻlim.', 'Penya — 8.5-band.'], 'Taraflar imzolari'))],
    ),
  },
  {
    match: /yetkazib|tovar|supply/i,
    stage: () => preset('Yetkazib berish', 'yetkazib berilgan tovar haqi', { principal: 'client', opponent: 'lawyer' },
      [sheet('supply', 'Yetkazib berish shartnomasi', 'Tovar, muddat va toʻlov sharti.', page('Taraflar', 'YETKAZIB BERISH SHARTNOMASI', ['Tovar, miqdori, narxi.', 'Yetkazib berish va toʻlov muddatlari.'], 'Taraflar imzolari')),
        folder('waybills', 'Yuk xatlari', 'Tovar topshirilganini tasdiqlovchi hujjatlar.', [page('Yetkazib beruvchi', 'YUK XATLARI', ['Tovar qabul qilinganini koʻrsatuvchi imzolar.'])], '#7a5a2f')],
      [folder('quality', 'Sifat boʻyicha dalolatnomalar', 'Tovar kamchiliklari qayd etilgan hujjatlar.', [page('Oluvchi', 'DALOLATNOMA', ['Qabul paytida aniqlangan kamchiliklar.'])], '#5a2f2f')]),
  },
  {
    match: /pudrat|qurilish|taʼmir|ta'mir|remont/i,
    stage: () => preset('Pudrat', 'pudrat ishlari haqi yoki sifati', { principal: 'worker', opponent: 'lawyer', witness: 'clerk' },
      [sheet('contract', 'Pudrat shartnomasi', 'Ish hajmi, muddati va qabul qilish tartibi.', page('Buyurtmachi va pudratchi', 'PUDRAT SHARTNOMASI', ['Ish hajmi va muddatlari.', 'Ishni qabul qilish tartibi.'], 'Taraflar imzolari')),
        sheet('acceptance', 'Bajarilgan ishlar dalolatnomasi', 'Ish topshirilganini koʻrsatadi — imzolar muhim.', page('Pudratchi', 'BAJARILGAN ISHLARNI QABUL QILISH DALOLATNOMASI', ['Bajarilgan ishlar roʻyxati.', 'Taraflar imzolari uchun joy.']))],
      [folder('estimate', 'Smeta va ekspert xulosasi', 'Ish sifati va narxi boʻyicha hujjatlar.', [page('Buyurtmachi', 'SMETA', ['Ish turlari va narxlari.']), page('Ekspert', 'EKSPERT XULOSASI', ['Aniqlangan kamchiliklar.'])], '#2f5a3f')]),
  },
  {
    match: /xizmat/i,
    stage: () => preset('Xizmat koʻrsatish', 'koʻrsatilgan xizmat haqi', { principal: 'client', opponent: 'woman' },
      [sheet('services', 'Xizmat koʻrsatish shartnomasi', 'Xizmat turi, muddati va haqi.', page('Taraflar', 'XIZMAT KOʻRSATISH SHARTNOMASI', ['Xizmat turi va muddati.', 'Haq toʻlash tartibi.'], 'Taraflar imzolari')),
        folder('acts', 'Xizmat dalolatnomalari', 'Xizmat koʻrsatilganini tasdiqlaydi.', [page('Ijrochi', 'DALOLATNOMALAR', ['Koʻrsatilgan xizmatlar roʻyxati.'])], '#7a5a2f')],
      [folder('letters', 'Yozishmalar', 'Xizmat sifati boʻyicha eʼtirozlar.', [page('Buyurtmachi', 'XATLAR', ['Kamchiliklar haqida bildirishnomalar.'])], '#5a2f2f')]),
  },
  {
    match: /qarz|zayom|zaem/i,
    stage: () => preset('Qarz', 'qarzni qaytarish', { principal: 'client', opponent: 'man' },
      [sheet('loan', 'Qarz shartnomasi', 'Qarz summasi va qaytarish muddati.', page('Qarz beruvchi va qarz oluvchi', 'QARZ SHARTNOMASI', ['Qarz summasi va qaytarish muddati.'], 'Taraflar imzolari')),
        sheet('transfer', 'Toʻlov topshiriqnomasi', 'Pul berilganini tasdiqlaydi.', page('Bank', 'TOʻLOV TOPSHIRIQNOMASI', ['Pul mablagʻi oʻtkazilgani.'], 'Bank belgisi'))],
      [folder('repaid', 'Qisman toʻlov hujjatlari', 'Qaytarilgan qism boʻyicha hujjatlar.', [page('Bank', 'TOʻLOV HUJJATLARI', ['Qaytarilgan summalar.'])], '#2f5a3f')]),
  },
  {
    match: /sugʻurta|sug'urta|sugurta/i,
    stage: () => preset('Sugʻurta', 'sugʻurta tovonini undirish', { principal: 'man', opponent: 'woman', witness: 'clerk' },
      [sheet('policy', 'Sugʻurta polisi', 'Sugʻurta holatlari va summasi.', page('Sugʻurtalovchi', 'SUGʻURTA POLISI', ['Sugʻurta obyekti va holatlari.', 'Sugʻurta muddati.'], 'Sugʻurtalovchi muhri')),
        sheet('appraisal', 'Baholovchi hisoboti', 'Zarar miqdori shu hisobotda.', page('Baholash tashkiloti', 'BAHOLASH HISOBOTI', ['Zarar miqdorini aniqlash.']))],
      [sheet('refusal', 'Tovon toʻlashni rad etish xati', 'Sugʻurtalovchining rad etish asoslari.', page('Sugʻurtalovchi', 'RAD ETISH TOʻGʻRISIDA XAT', ['Rad etish sabablari.']))]),
  },
  {
    match: /lizing/i,
    stage: () => preset('Lizing', 'lizing toʻlovlari', { principal: 'worker', opponent: 'man' },
      [sheet('leasing', 'Lizing shartnomasi', 'Lizing obyekti va toʻlovlar jadvali.', page('Lizing beruvchi va lizing oluvchi', 'LIZING SHARTNOMASI', ['Lizing obyekti.', 'Toʻlovlar jadvali — ilova.'], 'Taraflar imzolari')),
        folder('schedule', 'Toʻlovlar jadvali va solishtirma dalolatnoma', 'Qarz qaysi oylar uchun ekani.', [page('Lizing beruvchi', 'SOLISHTIRMA DALOLATNOMA', ['Hisob-kitoblar holati.'])], '#7a5a2f')],
      [sheet('defect', 'Obyekt nosozligi dalolatnomasi', 'Obyektdan foydalanib boʻlmagan davr.', page('Lizing oluvchi', 'DALOLATNOMA', ['Nosozlik aniqlangan sana va holati.']))]),
  },
  {
    match: /bekor|zarar/i,
    stage: () => preset('Shartnomani bekor qilish', 'shartnomani bekor qilish va zararni undirish', { principal: 'client', opponent: 'lawyer' },
      [sheet('contract', 'Shartnoma', 'Majburiyatlar va javobgarlik sharti.', page('Taraflar', 'SHARTNOMA', ['Taraflarning majburiyatlari.', 'Javobgarlik sharti.'], 'Taraflar imzolari')),
        sheet('claimletter', 'Talabnoma (pretenziya)', 'Nizoni sudgacha hal qilishga urinish.', page('Daʼvogar', 'TALABNOMA', ['Buzilish va talab.'])),
        folder('losses', 'Zarar hisob-kitobi', 'Zarar miqdori va uning asoslari.', [page('Daʼvogar', 'ZARAR HISOB-KITOBI', ['Zarar tarkibi.'])], '#5a2f2f')],
      [sheet('answer', 'Talabnomaga javob', 'Javobgarning pozitsiyasi.', page('Javobgar', 'TALABNOMAGA JAVOB', ['Eʼtirozlar.']))]),
  },
  {
    match: /kafil|kafolat/i,
    stage: () => preset('Kafillik', 'kafil boʻyicha talab', { principal: 'client', opponent: 'woman' },
      [sheet('main', 'Asosiy shartnoma', 'Kafillik taʼminlagan majburiyat.', page('Taraflar', 'ASOSIY SHARTNOMA', ['Taʼminlangan majburiyat.'], 'Taraflar imzolari')),
        sheet('surety', 'Kafillik shartnomasi', 'Kafil javobgarligi doirasi.', page('Kreditor va kafil', 'KAFILLIK SHARTNOMASI', ['Kafil javobgarligi doirasi va muddati.'], 'Taraflar imzolari'))],
      [folder('notice', 'Bildirishnomalar', 'Kafilga qachon va qanday talab qoʻyilgani.', [page('Kafil', 'BILDIRISHNOMALAR', ['Talab qoʻyilgan sanalar.'])], '#2f5a3f')]),
  },
  {
    // (disputes with state bodies over their decisions go to administrative courts, not here: no such preset)
    match: /tashish|yuk|transport|ekspeditsiya/i,
    stage: () => preset('Yuk tashish', 'tashish paytida yoʻqolgan yoki shikastlangan yuk', { principal: 'client', opponent: 'man', witness: 'worker' },
      [sheet('carriage', 'Tashish shartnomasi', 'Tashuvchining majburiyatlari va javobgarligi.', page('Yuk joʻnatuvchi va tashuvchi', 'TASHISH SHARTNOMASI', ['Yuk, yoʻnalish va muddat.', 'Tashuvchining javobgarligi sharti.'], 'Taraflar imzolari')),
        sheet('waybill', 'Transport yuk xati', 'Yuk tashuvchiga qanday holatda topshirilgani.', page('Yuk joʻnatuvchi', 'TRANSPORT YUK XATI', ['Yuk tavsifi va miqdori.', 'Qabul qilgan haydovchi imzosi.'])),
        sheet('shortage', 'Kamomad dalolatnomasi', 'Yetib kelganda aniqlangan kamomad yoki shikast.', page('Yuk oluvchi', 'DALOLATNOMA', ['Yetib kelgan yukning holati.']))],
      [folder('route', 'Yoʻl hujjatlari', 'Tashish sharoitlari va yoʻldagi holatlar.', [page('Tashuvchi', 'YOʻL VARAQASI', ['Yoʻnalish va toʻxtashlar.'])], '#2f3f5a')]),
  },
];

const DEFAULT = (): CourtStage => preset('Iqtisodiy nizo', 'iqtisodiy nizo', { principal: 'client', opponent: 'lawyer' }, [], []);

/** The server's own stage, when its scenario pack sends one (validated loosely: anything missing falls back). */
export interface ServerScene {
  kind?: string;
  voices?: Partial<Record<VoiceRole, string>>;
  cast?: Partial<CourtStage['cast']>;
  papers?: Partial<Record<Side, DeskDoc[]>>;
}

const MODELS: CharacterModel[] = ['elder_man', 'woman', 'man', 'worker', 'secretary', 'lawyer', 'client', 'clerk', 'investigator', 'chief'];
const model = (m: unknown): CharacterModel | undefined => (MODELS.includes(m as CharacterModel) ? (m as CharacterModel) : undefined);

const clean = (v: ServerScene['voices']) => Object.fromEntries(Object.entries(v ?? {}).filter(([, id]) => typeof id === 'string' && /^[a-z][a-z0-9_]{1,23}$/.test(id)));

export function courtStageFor(scenario: { id: string; title: string; scene?: ServerScene | null }): CourtStage {
  const base = (PRESETS.find((p) => p.match.test(`${scenario.title} ${scenario.id}`))?.stage ?? DEFAULT)();
  const s = scenario.scene;
  if (!s) return base;
  return {
    kind: s.kind || base.kind,
    cast: {
      principal: s.cast?.principal === null ? null : (model(s.cast?.principal) ?? base.cast.principal),
      opponent: model(s.cast?.opponent) ?? base.cast.opponent,
      witness: model(s.cast?.witness) ?? base.cast.witness,
    },
    papers: { claimant: s.papers?.claimant?.length ? s.papers.claimant : base.papers.claimant, respondent: s.papers?.respondent?.length ? s.papers.respondent : base.papers.respondent },
    voices: { ...base.voices, ...(s.cast?.opponent || s.cast?.witness ? voicesFor({ ...base.cast, ...s.cast, principal: null } as CourtStage['cast']) : {}), ...clean(s.voices) },
  };
}

/** Every preset, for QA and the scene gallery. */
export const ALL_PRESETS = () => [...PRESETS.map((p) => p.stage()), DEFAULT()];
