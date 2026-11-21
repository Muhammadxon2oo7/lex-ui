# LexSim - frontend: qanday qurilgan

**Kimga:** loyiha jamoasi, mentorlar, backend dasturchisi, hakamlar.
**Sana:** 2026-11-21.
**Repo:** `lexsim-web` (GitHub `lex-ui`, `main`), Netlify'da joylashtiriladi.

---

## 1. Qisqacha

LexSim - huquqshunos talabalar uchun virtual amaliyot. Talaba yo'nalishni tanlaydi (advokat, jabrlanuvchi vakili, sudya, iqtisodiy sudda tomon vakili, davlat xizmatchisi, jamoaviy bahs) va 3D xonalarda haqiqiy jarayonni boshidan oxirigacha o'tadi: hujjat yozadi, gapiradi, sud qaror chiqaradi, oxirida tahlil va bayonnoma oladi.

Frontend ikki qismdan iborat:
- **Ilova** - Next.js sahifalari, 3D sahnalar, ovoz;
- **Server qismi** (shu repo ichida, Next.js API marshrutlari) - ish dvigatellari, baholash, sud serveriga (backend) xavfsiz ko'prik.

Backend (`lex-api`, FastAPI) - alohida: til modeli, STT, TTS, ssenariylar, saqlash.

---

## 2. Stack

| Qatlam | Texnologiya | Nima uchun |
|---|---|---|
| Framework | **Next.js 16.4** (App Router, Turbopack, `cacheComponents`) | Server va mijoz bitta loyihada; API marshrutlar kalitni brauzerdan yashiradi |
| UI | **React 19.3**, TypeScript (strict) | |
| Uslub | **Tailwind CSS 4.3** + o'z dizayn tokenlari (`globals.css`) | Apple-soft yorug' dizayn, SF Pro tizim shrifti |
| Harakat | **motion** (Framer Motion) 14 | Prujina (spring) animatsiyalar, shared layout morph, tortib yopiladigan varaqlar |
| 3D | **three.js r187**, **@react-three/fiber 9**, **drei 10** | Xonalar, personajlar, kamera |
| 3D effektlar | **@react-three/postprocessing**, **n8ao** | Yumshoq soya (AO), rang korreksiyasi - faqat kuchli qurilmada |
| Fizika | **@react-three/rapier** | Kampusda yurish, to'qnashuvlar |
| Holat | **zustand** 5 | Kampus va sozlamalar |
| Kontrakt | **zod** 4 | Har bir API javobi tekshiriladi; noto'g'ri javob ekranga chiqmaydi |
| Modellar | **glTF** + `@gltf-transform/cli` | Personaj va buyumlar siqilgan holda |
| Test | **vitest** 5 (81 test), **Playwright** 1.65 (brauzer QA) | |
| Lint | ESLint 9 + `eslint-config-next` | |
| Hosting | Netlify (serverless) | |

---

## 3. Tuzilma

```
src/
  app/                  sahifalar va API
    page.tsx            landing - yo'nalish kartalari
    kampus/             3D kampus (binoda yurish)
    ish/[id]/[stage]/   "Ish yo'li": maslahat -> Hujjatlar -> devonxona -> sudya kabineti -> majlis
    court/[id]/         sudya o'rnida majlis (FPK)
    sud/[sessionId]/    iqtisodiy sud (backend ssenariylari, til modeli)
    simulation/         DXM xodimi
    bahs/               jamoaviy sud (multiplayer)
    sohalar/, mentor/   sohalar, caselar (AI qoralama), mentor tekshiruvi
    manbalar/           normativ manbalar
    protsess/, hub/     kutubxona, 2D rejim
    api/v1/             server marshrutlari (cases, hearings, sessions, moot, voice, remote)
  components/
    world/              3D: sud zali, personajlar, materiallar
    case/               xonalar sahnasi, "Hujjatlar" muharriri
    campus/             3D kampus va terminal
    landing/, ui/       landing, Liquid Glass primitivlari
    hud/, record/       ekran ustidagi panellar, bayonnoma
  server/               dvigatellar (faqat serverda)
    case/               ish dvigateli, ariza tekshiruvi (FPK 189-191, 195)
    moot/               bahs xonasi, sudya qarori
    law/                FPK, JPK moddalari - lex.uz'dan so'zma-so'z
    remote/, voice/     backend bilan ko'prik, ovoz
  contracts/            zod kontraktlari (ish, majlis, bahs)
  data/                 normativ manbalar reyestri + yo'nalishlar xaritasi
  game/, lib/           mijoz yordamchilari: API, ovoz, profil, qurilma darajasi
tools/qa/               Playwright sinovlari (moot, draft, live, perf, ...)
```

---

## 4. Asosiy yechimlar

### Xavfsizlik va ishonch
- **Kalit brauzerga chiqmaydi.** Backend kaliti (`LEXSIM_REMOTE_KEY`) faqat Netlify muhitida; brauzer faqat o'z `/api/v1` marshrutlarimizga murojaat qiladi.
- **Talaba anonim.** Backendga ism emas, tuzlangan xesh (`X-LexSim-Owner`) boradi.
- **Server - yagona hakam.** Ball, yashirin faktlar, raqib tomonning maxfiy ma'lumoti, taymer - hammasi serverda. Mijoz faqat o'z ko'rinishini oladi.
- **Kontrakt.** Har bir javob zod bilan tekshiriladi; shakl buzilsa, xato ko'rsatiladi, yarim-yolg'on ma'lumot emas.

### Huquqiy aniqlik - "Manba bo'lmasa, modda yo'q"
- Moddalar matni lex.uz'dan skript bilan yuklab olinadi (`legal/sources`), qo'lda yozilmaydi.
- `src/data/sources.json` - 21 hujjat reyestri (tahrir sanasi, olingan sana, havola).
- **Test** koddagi har bir "N-modda" havolasini reyestr bilan solishtiradi: to'qilgan modda o'tmaydi.
- `/manbalar` sahifasi har yo'nalish qaysi moddaga tayanishini ko'rsatadi.

### Dvigatellar
- **Ish dvigateli** - tugunlar grafi (gap, tanlov, natija), har qadam moddaga bog'langan; erkin javob backenddagi `/nlu/match` orqali tushuniladi, inson vaziyatlari (`situation`: so'kinish, hujjat yo'q, rus tilida) alohida.
- **Ariza tekshiruvi** - talaba yozgan matn ish papkasi bilan so'zlar bo'yicha solishtiriladi; xato aniq FPK bandiga bog'lanadi (195-modda: qaytarish asoslari).
- **Bahs** - server tomonidagi xona dvigateli, long-poll (versiya bo'yicha), qur'a, navbat, taymer, aloqadan chiqqanlar, qoida bahosi + backend til modeli qarori (`judge_pending` bo'lsa avval dastlabki baho).
- **Saqlash** - serverless instansiya yangilansa ham ish yo'qolmaydi: holat backend `/store` ga yoziladi va qayta tiklanadi.

### Ovoz
- TTS va STT faqat backenddan (Azure olib tashlangan).
- Keyingi 3 gap oldindan yuklanadi (prefetch) - pauza qisqa.
- Brauzer nutqni tanishi parallel ishlaydi: so'zlar ekranda jonli chiqadi, server javobi 4 s dan kechiksa brauzer natijasi olinadi.
- Talabaning o'z ovozi IndexedDB'da saqlanadi va bayonnomaga (WAV) qo'shiladi.

### 3D va tezlik
- **Qurilma darajasi** (`low`/`medium`/`high`) birinchi kadrdan oldin aniqlanadi: kuchsiz qurilmada post-effektlar, soyalar va blur o'chadi, 30 fps.
- **QualityGovernor** faqat pastga tushiradi va sahna barqarorlashgandan keyin baholaydi.
- Modellar siqilgan, teksturalar plitkali, chiroqlar RectAreaLight.

### Dizayn - Apple uslubi (Liquid Glass)
- **Shisha faqat navigatsiyada:** suzuvchi sarlavha kapsulalari, segmentli boshqaruv (sirpanuvchi linza), varaqlar, suzuvchi tugmalar. **Kontent qattiq oq kartalarda** - o'qish oson.
- Material: rangli fon + `backdrop-filter` blur + yorug' qirra (rim light) + kursorga ergashuvchi yorug'lik (`globals.css`, `components/ui/glass.tsx`).
- Orqa fon - statik rangli dog'lar (radial gradient, filtrsiz): shisha ostida hech narsa qimirlamaydi, kadr tezligi saqlanadi.
- Harakat: faqat `transform`/`opacity`, prujinalar (bounce 0 yoki kichik), karta rasmi profil varag'iga "oqib" o'tadi (shared layout), telefonda varaq pastga tortib yopiladi.
- Imkoniyatlar: `prefers-reduced-motion`, `prefers-reduced-transparency` (shisha qattiq bo'ladi), `prefers-contrast`; kuchsiz qurilmada blur o'chadi, rang qoladi.
- Matnda o'zbek lotin imlosi: `ʻ` (U+02BB) va `ʼ` (U+02BC).

### Sohalar va caselar (backend case-lab)
- `/sohalar` - sohalar (2025-yil sud statistikasi ulushi bilan), `/sohalar/{id}` - tizim va foydalanuvchi caselari, "Case qo'shish" (AI qoralama 45-95 s, savollar, tahrir, mentorga yuborish), `/mentor` - tekshiruv navbati.
- Hammasi `/api/v1/library/*` orqali: kalit, egasining xeshi va mentor tokeni faqat serverda; boshqalarning maxfiy faktlari serverda ham tozalanadi.

### Harakat tizimi (Apple "Designing Fluid Interfaces")
- Umumiy tokenlar `src/lib/motion.ts`: sirtlar - `bounce 0` (~0,35 s), varaq va panellar - `bounce 0,15`, ketish - tezroq va sakrashsiz; sakrash faqat siltash va kichik "tomchi" elementlarda.
- `Drawer` (yon panellar) va `Sheet` (modal varaqlar): chiqqan yo'li bilan qaytadi, sarlavhadan ushlab tortiladi, siltashning yakuniy nuqtasi hisoblanadi (momentum projection), Esc va tashqariga bosish yopadi, ichidagi matn belgilanadi.
- Hamma ekranlar `MotionConfig reducedMotion="user"` ostida: harakat kamaytirilsa, siljish o'rniga yumshoq paydo bo'lish.

### Hujjatlar va natija
- "Hujjatlar" xonasi: sud ro'yxatdan tanlanadi ("Sudlar to'g'risida"gi Qonun, 2-modda), qolgani yoziladi; advokat orderi rasmiy 12 bandli shakl bo'yicha.
- Bayonnoma: matn + umumiy audio, PDF, Word, WAV, xAPI (LMS uchun).

---

## 5. Sifat tekshiruvlari

```bash
npm run typecheck          # TypeScript
npm run lint               # ESLint
npm test                   # vitest: 81 test
node tools/qa/moot.mjs     # bahs: 2 brauzer, to'liq majlis - 11/11
node tools/qa/draft.mjs    # Hujjatlar: order + ariza + sud qabul qiladi - 4/4
node tools/qa/library.mjs  # sohalar va case oqimi - 8/8
node tools/qa/live.mjs     # backend bilan jonli (kalit kerak, Netlify)
node tools/qa/perf.mjs     # 3D kadr tezligi
```

---

## 6. Muhit o'zgaruvchilari

| O'zgaruvchi | Qayerda | Nima |
|---|---|---|
| `LEXSIM_REMOTE_KEY` | faqat Netlify | Backend kaliti. Lokal `.env.local` da yo'q, repoga hech qachon tushmaydi |
| `LEXSIM_MENTOR_CODE`, `LEXSIM_ADMIN_TOKEN` | faqat Netlify | Mentor kirish kodi va backend admin tokeni (mentor sahifasi uchun) |
| `LEXSIM_REMOTE_URL` | Netlify | Backend manzili (`https://lex-api.e-investment.uz/api/v1`) |

Kalitsiz ham ilova ishlaydi: ish dvigatellari va qoida bahosi lokal; til modeli, STT va TTS bo'lmaydi.
