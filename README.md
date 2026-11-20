# LexSim 3D — DXM vertical slice

`dxm-yoqolgan-staj` ssenariysining boshidan oxirigacha ishlaydigan 3D amaliyoti:
brifing → 3D markaz → Rustam aka bilan suhbat → yashirin faktlar → “choy puli” → terminalda hujjat → 6 mezonli hisobot.

```bash
npm install
npm run assets     # Poly Haven (CC0) → public/assets (bir marta; natija repoda bor)
npm run dev        # http://localhost:3000
npm test           # ssenariy dvigateli testlari (Vitest)
npm run typecheck && npm run lint && npm run build
```

## Kirish: yoʻnaltirish terminali

`/` — talaba binoning foyesida, yoʻnaltirish terminali oldida paydo boʻladi. Birinchi marta: roʻyxatdan oʻtish (F.I.Sh., maqom, jins). Soʻng terminalda xonalar roʻyxati: tanlangan xonaning ichida paydo boʻlinadi. «Binoda yurish» — foye va 9 eshikli yoʻlakda uchinchi shaxs bilan erkin yurish (eshik oldida `E`). Profil brauzerda saqlanadi (`lexsim.profile.v1`). WebGL2 yoʻq qurilmalar `/hub` (2D) ga yoʻnaltiriladi.

## Ish yoʻli — ikki ish, har bir eshik bitta bosqich

| Ish | Xonalar (eshiklar) | Kodeks |
|---|---|---|
| 1. Sardor N. — ishga tiklash (siz — daʼvogar advokati) | 1 Advokatlik byurosi · 2 Hujjatlar xonasi · 3 Sud devonxonasi · 4 Sudya kabineti · 5 Sud majlisi zali | FPK |
| 2. Nodira K. — telefon oʻgʻirligi (siz — jabrlanuvchi advokati) | 7 IIB navbatchi qismi · 8 Tergovchi kabineti · 9 Tergov boʻlinmasi boshligʻi | JPK |

- Istalgan bosqichdan boshlash mumkin: oldingi bosqich oʻynalmagan boʻlsa, ish papkasi tayyor holda beriladi.
- Ssenariy: `src/server/case/ishga-tiklash.ts`, `src/server/case/ogirlik.ts` (har biri `CaseBook`); dvigatel: `src/server/case/engine.ts`.
- Moddalar faqat tasdiqlangan toʻplamdan: `npm run law` → `src/server/law/fpk-case.json`, `jpk-case.json`.
- Har bir gap xonaning shu paytdagi holatini (kim kirdi, kim turibdi) va hissiyotni olib keladi — harakat nutq bilan sinxron.
- Lab harakati: `src/lib/visemes.ts` — oʻzbek lotin yozuvidan viseme treki, ovoz (yoki subtitr) davomiyligiga moslanadi.
- Miltillash (z-fighting) nazorati: `node tools/qa/zfight.mjs` barcha xonalar, kampus va DXM boʻylab bir tekislikda turgan, bir tomonga qaragan va bir-birini qoplaydigan sirtlarni qidiradi (dev serverda `DevProbe` orqali). Qoida: devorga taqaladigan jihoz `againstWall()` bilan 15 mm oldinda turadi, ustma-ust tushadigan plitalar esa kamida 2 mm farq qiladi.
- QA: `node tools/qa/case.mjs`, `theft.mjs`, `motion.mjs`, `draft.mjs`, `audit.mjs`, `dxm-audit.mjs`, `symbols.mjs`, `dismiss.mjs`. Sudya mantiyasini yaqindan koʻrish (faqat dev): `/dev/mantle`.
- Birinchi instansiyada fuqarolik ishini sudya yakka tartibda koʻradi (FPK 17-modda). Zaldagi uchta kreslo real zallardagidek turadi — hayʼat majlislari ham shu zalda oʻtadi.
- Barcha modal va drawerlar orqa fon bosilganda yopiladi (`src/lib/useDismiss.ts`). Bunga ikki istisno bor: bosqich natijasi va brifing — ulardan keyingi qadamni faqat shu oynada tanlash mumkin.

## Iqtisodiy sud — tashqi sud serveri bilan

- **Yoqish:** `.env.local` → `LEXSIM_REMOTE_URL=http://192.168.88.110:8100/api/v1`. Bu qator boʻlmasa, boʻlim yashiriladi va boshqa hech narsa oʻzgarmaydi.
- **Kirish:** hub → «Iqtisodiy sud» → rol tanlanadi → `/sud/rmt_…`. Sahna — bizning sud zali.
  - Javobni talabaning oʻzi yozadi yoki aytadi (`T`).
  - `G` — oʻrnidan turish, `M` — maslahat (−5).
  - Raqib tomon javobi LLM'da tayyorlanayotganda «Raqib advokat javob tayyorlamoqda…» koʻrsatiladi.
  - Majlisdan keyin — mavjud hisobot sahifasi, qarorlar tahlili bilan.
- **Adapter:** `src/server/remote/court.ts`. Brauzer server bilan toʻgʻridan-toʻgʻri gaplashmaydi; har bir javob bizning Zod sxemalarimizdan oʻtadi.
- **Ovoz:** Azure kaliti boʻlmasa, sud serverining oʻzbekcha TTS/STT'si ishlatiladi. Hozircha faqat sud sessiyasi ochiq talabalar uchun.
- **QA:** `node tools/qa/economic.mjs`.
- **Hujjatlar:**
  - `docs/COURT_BACKEND.md` — kontraktni moslashtirish;
  - `docs/BACKEND_AI_ROADMAP.md` — backend va AI audit, darajalar standarti, toʻliq topshiriq.

## Pedagogika: prebrief → qarorlar → tahlil

Simulyatsiya standartlariga (INACSL prebriefing/debriefing, branching-scenario amaliyoti) mos:
- **Prebrief.** Har bosqich boshida karta chiqadi: rol, vazifa, nima baholanishi va asosiy tugmalar. Birinchi javobdan keyin yashirinadi.
- **Maslahat (`M`, −5 ball).** Toʻgʻri javob tayanadigan moddani koʻrsatadi; maslahat bosqichida esa hali aniqlanmagan muhim holatni. Bir daqiqa uchun bir marta hisoblanadi.
- **Tahlil (debrief).** Har bir qaror koʻrsatiladi:
  - nimaga javob berilgani va nima tanlangani;
  - necha ball yoʻqotilgani va nega;
  - **yaxshiroq javob** va uning moddasi (bosilsa, kodeks ochiladi);
  - qarorlar, xatolar va maslahatlar soni.
- **Mulohaza.** Har bosqichdan keyin bitta refleksiya savoli beriladi. Javob faqat shu brauzerda saqlanadi.
- **Hisobot (JSON).** xAPI shaklidagi bayonotlar (actor / verb / object / result), aktyor anonim. Keyinchalik LMS yoki LRS (LTI 1.3 / cmi5) ga oʻzgartirishsiz ulanadi.

## Huquqiy manbalar (FPK paketidan tashqari, lex.uz dan soʻzma-soʻz tekshirilgan)

- **«Davlat boji toʻgʻrisida»gi Qonun (OʻRQ-600, 06.01.2020), 8-modda 1-qism 1-band** — mehnat munosabatlaridan kelib chiqadigan talablar boʻyicha daʼvogarlar boj toʻlamaydi ([lex.uz/docs/-4680944](https://lex.uz/docs/-4680944)). Arizaga faqat pochta xarajatlari kvitansiyasi ilova qilinadi. Boj kvitansiyasi esa tuzoq.
- **Mehnat kodeksi** ([lex.uz/docs/-6257288](https://lex.uz/docs/-6257288)):
  - **174-modda** — bekor qilishning qonuniyligini ish beruvchi isbotlaydi;
  - **313-modda** — intizomiy jazodan oldin yozma tushuntirish talab qilinishi shart;
  - **560-modda** — ishga tiklash boʻyicha sudga murojaat muddati: buyruq nusxasi berilgandan uch oy.
- **FPK:**
  - **21–22** — kim rad qilinadi;
  - **217** — huquqlarni tushuntirish;
  - **225** — maʼruza;
  - **229** — guvohning qasamyodi va tilxati;
  - **233** — yozma dalillar;
  - **243** — mazmunan muhokamani tugatish;
  - **266 (4-band)** — ishga tiklash toʻgʻrisidagi qaror darhol ijro etiladi.

## Texnik standartlar

- **Ekran va unumdorlik:**
  - `Adaptive` (drei `PerformanceMonitor`): kadr tezligi tushsa, DPR 1 ga tushadi va N8AO/Bloom oʻchadi;
  - `FitFov`: tor yoki portret ekranda linza kengayadi, sahna kesilmaydi.
- **Xatolar va tarmoq:**
  - `error.tsx` — sahna xatosida ish yoʻqolmaydi, «Qayta urinish» tugmasi chiqadi;
  - barcha `fetch` soʻrovlarida `AbortSignal.timeout`.
- **Xavfsizlik:** `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` (faqat mikrofon). CSP production buildda sinovdan keyin qoʻshiladi.
- **Metadata:** OG metadata va `viewportFit: cover`.

## Davlat ramzlari, nomlar va imlo

- **Bayroq va gerb hech qachon qoʻlda chizilmaydi.** Ular rasmiy tasvirdan (`tools/symbols/*.svg`) `node tools/symbols/rasterise.mjs` orqali `public/assets/symbols/` ga chiqariladi.
  - Bayroq: 18.11.1991 yildagi 407-XII-son qonun ([lex.uz/docs/-100122](https://lex.uz/docs/-100122)). Nisbati 1:2, chiziqlari 40 / 2,5 / 40 / 2,5 / 40, yulduzlar 3–4–5.
  - Gerb: 02.07.1992 yildagi 616-XII-son qonun ([lex.uz/docs/-17260](https://lex.uz/docs/-17260)).
  - Sud majlisi zalida Davlat gerbining tasviri boʻlishi «Sudlar toʻgʻrisida»gi qonunning 7-moddasida belgilangan ([lex.uz/docs/-5534923](https://lex.uz/docs/-5534923)).
  - Bayroq xona egasining oʻng tomonida turadi.
- **Sud nomi:** «Fuqarolik ishlari boʻyicha Namuna tumanlararo sudi» (OʻRQ-703 dagi tartib).
- **Hal qiluv qarori** «Oʻzbekiston Respublikasi nomidan» qabul qilinadi (FPK 249-modda). U kirish, bayon, asoslantiruvchi va xulosa qismlaridan iborat (FPK 253-modda).
- **Kasallik varaqasi:** «Mehnatga layoqatsizlik varaqasi», 2024-yildan faqat elektron shaklda beriladi.
- **Ishga tiklash nizosi** boʻyicha sudga murojaat muddati — 3 oy (Mehnat kodeksi 560-modda).
- **Imlo:** oʻ/gʻ uchun ʻ (U+02BB), tutuq belgisi uchun ʼ (U+02BC) ishlatiladi — lex.uz bilan bir xil.
  - Foydalanuvchi kiritgan matnda kelgan ‘ ’ ' belgilari `src/lib/uz.ts` da bir xil koʻrinishga keltiriladi.
  - Qisqartma va domenlarga qoʻshimcha tutuq bilan ulanmaydi: «lex.uz saytidan», «DXMda».
- **Tasdiqlanmagan atamalar ishlatilmaydi.** Masalan, «talon-xabarnoma» oʻrniga «Ariza qabul qilingani haqida maʼlumot».

## Ovoz

Aktyorlar gapiradi, talaba ovoz bilan javob beradi (`T` ni bosib turib gapirish). Aytilgan gap taklif qilingan javoblarning eng yaqiniga moslanadi (`src/lib/uz.ts`); mos kelmasa — DXMda erkin javob sifatida yuboriladi, sud zalida qayta aytish soʻraladi.

| Kalit | Natija |
| --- | --- |
| `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` | Oʻzbekcha neyron ovozlar (Sardor, Madina) va nutqni tanish; lab harakati ovoz balandligiga bogʻlangan |
| kalitsiz | Brauzerning oʻzbekcha tizim ovozi boʻlsa — u; boʻlmasa aktyorlar faqat subtitr bilan. Nutqni tanish — brauzer `uz-UZ` ni qoʻllasa |

Azure integratsiyasi hujjatlashtirilgan REST endpointlar boʻyicha yozilgan, lekin haqiqiy kalit bilan hali sinalmagan.

## Ikki mashq

- **Davlat xizmatlari markazi** (`/hub` → DXM xodimi): yurish, suhbat, buyumlar, operator ish joyi, hisobot.
- **Sud zali** (`/hub` → Majlis zaliga kirish): raislik qiluvchi sifatida fuqarolik ishi boʻyicha majlisni FPK tartibida 14 bosqichda olib borish. Moddalar matni `../legal/sources` dan (lex.uz, soʻzma-soʻz) `node tools/build-law.mjs` bilan olinadi; qoʻlda yozilgan modda yoʻq. Ish holatlari toʻqilgan va shunday belgilangan.

Alohida backend servis: `../lexsim-api` (Hono + PostgreSQL/PGlite + Claude adapterlari). Hozircha frontend oʻz ichidagi namuna API bilan ishlaydi; sud majlisi endpointlari (`/api/v1/hearings`) backendga hali koʻchirilmagan.

## Boshqaruv

| Qayerda | Tugma | Amal |
| --- | --- | --- |
| Yurish | `W A S D`, sichqoncha, `Shift` | Yurish, qarash, tez yurish |
| Yurish | `E` yoki chap klik | Eshikni ochish/yopish, stolga oʻtirish, terminal |
| Suhbat | `1`–`4`, `Q` | Javob variantini tanlash, boshqa variantlar |
| Suhbat | `Space` | Replikani oʻtkazib yuborish |
| Suhbat | `T` | Oʻz soʻzingiz bilan javob |
| Suhbat | `F` / `V` / `R` / `G` | Terminal / ish daftari / telefondagi surat / oʻrnidan turish |
| Har joyda | `Esc` | Pauza va sozlamalar |

## Stack (2026-11-20 holatiga npm reyestridan tekshirilgan)

| Qatlam | Tanlov |
| --- | --- |
| Platforma | Next.js 16.4 (App Router, Cache Components), React 19.3, TypeScript, Tailwind 4 |
| Render | three 0.187 + React Three Fiber 9.8 (stable, WebGL2) + drei 10 |
| Fizika | Rapier (`@react-three/rapier` 2.2) — kinematic character controller |
| Post | `@react-three/postprocessing` 3: N8AO → Bloom → SMAA → ACES |
| Holat / kontrakt | Zustand 5 · Zod 4 (`src/contracts`) |
| UI harakati | Motion (kritik soʻndirilgan spring, `prefers-reduced-motion`) |
| Asset | glTF Transform (Meshopt + WebP), HDRI IBL |

R3F v10 alpha / WebGPU ataylab ishlatilmagan (masterplan §1.2).

## Tuzilma

```
src/contracts/        Zod kontraktlar: event, snapshot, assessment (klient ↔ server)
src/server/           SERVER-ONLY: ssenariy (yashirin faktlar), intent, personaj, sessiya FSM, baholovchi
src/app/api/v1/       /sessions, /turns, /interactions, /documents, /finish, /events, /report, /appeal
src/game/             Zustand store, API klient, xona manifesti, protsedural audio
src/components/world/ 3D runtime (lazy chunk): Building, Furniture, Character, Player, WorldCanvas
src/components/hud/   DOM qatlam: brifing, HUD, suhbat, hujjat formasi, pauza
src/app/              / (landing), /hub, /simulation/[id] (3D yoki ?view=2d), /simulation/[id]/report
tools/                fetch-assets.mjs (asset pipeline), qa/*.mjs (Playwright walkthrough)
```

## Asosiy qarorlar

- **Server authoritative.** Yashirin faktlar, sabr/ishonch, ball va manbalar faqat serverda. Klient har javobni Zod bilan tekshiradi; `sequence` monoton, mutatsiyalar client-id boʻyicha idempotent, sessiya HttpOnly cookie faylga bogʻlangan.
- **Personaj ≠ baholovchi.** Personaj agenti faqat ochilgan faktlar va “beat”ni oladi; ideal yoʻl va rubrikani koʻrmaydi.
- **Manba boʻlmasa, modda yoʻq.** Hisobotda faqat qonun nomlari; modda raqami/tahrir sanasi `verifiedAt: null` → “mentor tekshirsin”.
- **Xona = maʼlumot.** `src/game/manifest.ts`: devorlar, kolliderlar, interaktiv nuqtalar. Yangi xona — yangi manifest.
- **Matn DOM ichida.** 3D sahnadagi monitor faqat trigger; forma, suhbat va hisobot HTML sahifada (oʻqilishi, klaviatura, ekran oʻquvchi).
- **2D rejim** bir xil sessiya va server holati bilan ishlaydi (WebGL2/sichqoncha yoʻq boʻlsa avtomatik).

## Hali qilinmagan (halol roʻyxat)

- Suhbat **javob variantlari** orqali (server beradi) yoki erkin matn bilan. Personaj **ssenariyli** (tayyor replikalar; erkin matn uchun qoidaga asoslangan intent); jonli LLM ulanmagan — UI buni ochiq yozadi. `CharacterAgent` / `IntentClassifier` interfeyslari tayyor.
- Lex.uz RAG, FastAPI + PostgreSQL, auth, oʻqituvchi paneli, Telegram-bot, ovoz (STT/TTS) yoʻq. Sessiyalar xotirada (server qayta ishga tushsa yoʻqoladi).
- Odamlar — Microsoft Rocketbox avatarlari (MIT): real koʻrinish, lekin 2010-yillar oʻyin sifati. Tayyor animatsiya kliplari yoʻq: oʻtirish, nigoh, imo-ishora va mimika kod bilan boshqariladi; yurish va oʻrnidan turish animatsiyasi hali yoʻq.
- Xizmat nomlari, muddatlar, hujjatlar roʻyxati — oʻquv namunasi; DXM mutaxassisi/mentor tasdiqlamagan.
- Faqat macOS Chromium (Metal) da sinalgan; Safari, Firefox, Windows integrated GPU, telefon — sinalmagan.

Asset litsenziyalari: `public/assets/LICENSES.json` (Poly Haven, CC0) va `public/assets/characters/LICENSES.json` (Microsoft Rocketbox, MIT — mualliflik eslatmasi bilan). Personajlarni qayta yigʻish: `node tools/characters/build-characters.mjs`.
