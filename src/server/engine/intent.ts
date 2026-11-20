/**
 * Utterance → intent tags.
 *
 * The scenario engine never lets the character model decide which hidden
 * facts are unlocked. Instead every student utterance is classified into a
 * closed set of tags, and deterministic rules act on those tags.
 *
 * `RuleIntentClassifier` is the offline, deterministic implementation
 * (Uzbek Latin + Cyrillic). A model-backed classifier can be swapped in
 * behind the same interface without touching the engine.
 */

export type IntentTag =
  | 'greeting'
  | 'empathy'
  | 'paraphrase'
  | 'ask-work-period'
  | 'ask-documents'
  | 'ask-employer-status'
  | 'ask-previous-visits'
  | 'explain-service'
  | 'explain-documents'
  | 'explain-deadline'
  | 'explain-tracking'
  | 'dismiss'
  | 'rude'
  | 'jargon'
  | 'overpromise'
  | 'bribe-refuse'
  | 'bribe-accept'
  | 'injection';

export interface Intent {
  tags: Set<IntentTag>;
  isQuestion: boolean;
}

export interface IntentContext {
  bribePending: boolean;
}

export interface IntentClassifier {
  classify(text: string, ctx: IntentContext): Promise<Intent>;
}

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', ъ: "'", ь: '', э: 'e', ю: 'yu',
  я: 'ya', ў: "o'", қ: 'q', ғ: "g'", ҳ: 'h', ы: 'i', щ: 'sh',
};

/** Lower-case, unify apostrophes, transliterate Cyrillic, collapse spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ʻʼ‘’`´ʹ]/g, "'")
    .replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim();
}

const RULES: [IntentTag, RegExp][] = [
  ['greeting', /\b(assalomu|salom|va alaykum|xush kelibsiz|keling|marhamat)/],
  [
    'empathy',
    /(xavotir olmang|tashvishlanmang|tushunaman|tushundim|yordam beraman|yordam beray|birga ko'r|birgalikda|xafa bo'lmang|uzr|kechirasiz|bemalol|qiynalibsiz|charchagansiz|to'g'ri aytasiz|haqsiz|hal qilamiz|ko'rib chiqamiz)/,
  ],
  ['paraphrase', /(demak|to'g'ri tushundimmi|to'g'ri tushungan bo'lsam|ya'ni siz|tushunishimcha|aytmoqchisizki|shundaymi)/],
  [
    'ask-work-period',
    /((qaysi|qachon|nechanchi|necha) .{0,24}(yil|davr|vaqt)|qayerda ishla|qayerda mehnat|ish joy|kim bo'lib ishla|nima ish qil|mehnat faoliyat|qancha .{0,10}ishla|staj.{0,20}(qancha|qaysi|necha|haqida|ayting)|qaysi davr|ishlagan joy)/,
  ],
  [
    'ask-documents',
    /((qanday|qaysi|nima) .{0,16}hujjat|hujjat.{0,24}(bormi|bor mi|olib kel|qo'lingizda|yoningizda|ko'rsat)|mehnat daftarcha|daftarcha|trudov|ma'lumotnoma.{0,12}bormi|tasdiqlovchi|isbot|dalil)/,
  ],
  [
    'ask-employer-status',
    /((tashkilot|korxona|xo'jalik|kolxoz|ish joy|idora).{0,40}(hozir|bormi|bor mi|ishlayapti|faoliyat|tugat|yopil|mavjud|qayerda)|tugatilgan|qayta tashkil|huquqiy voris|vorisi)/,
  ],
  [
    'ask-previous-visits',
    /((avval|oldin|ilgari|bundan oldin|boshqa).{0,30}(murojaat|borgan|bordingiz|idora|joyga|tashkilot)|qayerga (murojaat|bordingiz)|kimga murojaat|qayerlarga)/,
  ],
  [
    'explain-service',
    /(arxiv.{0,40}(ma'lumotnoma|so'rov|hujjat|murojaat)|ma'lumotnoma.{0,30}arxiv|so'rov.{0,20}(yubor|rasmiylashtir|jo'nat)|ariza.{0,20}(qabul|rasmiylashtir|to'ldir|yoz)|stajni tasdiqla|staj.{0,20}tasdiq)/,
  ],
  ['explain-documents', /((kerakli|zarur|lozim|kerak bo'ladigan) hujjat|pasport|hujjatlar ro'yxat|nusxa|rasmlarini|suratlarini)/],
  ['explain-deadline', /(ish kuni|kun ichida|hafta ichida|muddat|\b\d+\s*(ish )?kun|oy ichida|ertaga|keyingi qadam)/],
  [
    'explain-tracking',
    /(sms|xabar (beramiz|keladi|qilamiz)|xabardor|kuzat|my\.gov|portal|telefon qil|qo'ng'iroq|holatini|ariza raqam|tilxat|kvitansiya)/,
  ],
  [
    'dismiss',
    /(bizda emas|bizning ish(imiz)? emas|boshqa (joyga|idoraga|tashkilotga) boring|menga emas|bilmayman|ilojim yo'q|qila olmayman|yordam bera olmayman|keyin keling|ertaga keling)/,
  ],
  [
    'rude',
    /(jim bo'l|baqirma|ahmoq|tentak|vaqtim yo'q|tez(roq)? gapir|gapni cho'zma|bas qil|yo'qol|chiqib ket|miyamni|esi past|valdira)/,
  ],
  [
    'jargon',
    /(normativ-huquqiy|dispozitsiya|imperativ|yurisdiksiya|legitim|prezumpsiya|subyekt|sub'ekt|protsessual|kompetensiya|reglamentatsiya|instansiya)/,
  ],
  [
    'overpromise',
    /(albatta (oshir|hal|ko'paytir)|kafolat beraman|kafolatlayman|bugunoq (hal|oshir|to'g'rila)|100 ?%|so'z beraman|nafaqangiz(ni)? oshir(ib|amiz)|aniq oshadi)/,
  ],
  [
    'injection',
    /(rolni unut|rolingni unut|ignore|system prompt|tizim ko'rsatma|baholash (tizimi|mezon)|ideal yo'l|yashirin fakt|sen ai|sun'iy intellekt|prompt)/,
  ],
];

const BRIBE_REFUSE =
  /(kerak emas|olmayman|ololmayman|qabul qilmayman|mumkin emas|bo'lmaydi|taqiqlan|noqonuniy|qonunga xilof|qonunga zid|pora|bepul|tekin|belgilangan tartib|haq olinmaydi|pul olinmaydi|pulingizni (oling|qaytar|yig'ishtir)|qaytarib oling|yo'q,? rahmat|shart emas|hojat yo'q)/;
const BRIBE_ACCEPT =
  /(mayli|xo'p|bo'pti|rahmat|qo'yib keting|tashlab keting|kelishdik|beraqoling|beravering|olaman|shu yerga qo'ying|tortmaga|yaxshi,? tezlashtir)/;

export class RuleIntentClassifier implements IntentClassifier {
  async classify(text: string, ctx: IntentContext): Promise<Intent> {
    const t = normalize(text);
    const tags = new Set<IntentTag>();
    for (const [tag, re] of RULES) if (re.test(t)) tags.add(tag);

    // A referral that also names the concrete service is routing, not a brush-off.
    if (tags.has('dismiss') && tags.has('explain-service')) tags.delete('dismiss');
    // Long, clause-heavy answers read as officialese to a tired pensioner.
    if (t.split(' ').length > 70) tags.add('jargon');

    if (ctx.bribePending) {
      if (BRIBE_REFUSE.test(t)) tags.add('bribe-refuse');
      else if (BRIBE_ACCEPT.test(t)) tags.add('bribe-accept');
    }
    return { tags, isQuestion: /\?|mi\b|chi\b/.test(t) };
  }
}
