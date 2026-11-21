# LexSim'dagi sun'iy intellekt: qaysi model, nima uchun, qanday nazorat ostida

**Kimga:** loyiha jamoasi, mentorlar, hakamlar va texnik mutaxassislar.
**Sana:** 2026-11-21. Raqamlar sud serverining jonli `/health` javobidan (v1.5.0) va loyihaning o'lchov hujjatlaridan olingan.

---

## Qisqasi

LexSim'da AI **yordamchi**, hakam emas. Uchta tamoyil:

1. **Avval tekshirilgan matn, keyin AI.** Qahramonlar va sudya iloji boricha oldindan yozilgan, mentor ko'rgan gaplar bilan gapiradi. AI faqat tayyor javob mos kelmaganda ishlaydi. Sud zalida gaplarning ~93 % i ssenariydan, ~6 % i javoblar bankidan, ~0,1 % i AI'dan.
2. **Qonun matni faqat lex.uz'dan.** AI moddani «xotiradan» aytmaydi: unga faqat bazadan topilgan moddalar beriladi, qolgani server tomonida o'chiriladi.
3. **Oxirgi so'z mentorniki.** AI bahosi hozircha mashq uchun. Rasmiy bahoga AI va mentor kelishuvi Koen kappasi ≥ 0,61 ga yetgach o'tiladi.

---

## 1. Modellar xaritasi

| # | Vazifa | Model | Qayerda ishlaydi | Tezlik |
|---|---|---|---|---|
| 1 | Til modeli (LLM): AI sudya, AI raqib, AI qahramon, case qoralamasi, «Bahs» bahosi | ChatGPT va Gemini, **AIHUB** orqali (vaqtinchalik) | Tashqi xizmat | 9-50 s; birinchi chaqiruv ~50 s |
| 2 | Qonun bazasidan qidiruv (RAG) | **bge-m3** embedding + so'z bo'yicha qidiruv + reranker | Sud serveri, reranker GPU'da | ~0,9 s |
| 3 | Talaba gapini tushunish (NLU) | bge-m3 + reranker + qoidalar (LLM'siz) | Sud serveri | 0,2-0,4 s |
| 4 | Nutqni matnga aylantirish (STT) | **Kotib** | Sud serveri, GPU | ~2,2-2,9 s / gap |
| 5 | Matnni nutqqa aylantirish (TTS) | **Chatterbox** (oldindan yozish) va **Meta MMS** (jonli zaxira) | Sud serveri, GPU | Tayyor gap keshdan darhol |
| 6 | Zaxira (server bo'lmasa) | Brauzerning o'z nutq vositalari va bizning so'z bo'yicha moslagichimiz | Talabaning brauzeri | - |

---

## 2. Til modeli (LLM)

### Nima qiladi

| Joy | Vazifa | Qachon ishga tushadi |
|---|---|---|
| Iqtisodiy sud zali | **AI sudya**: aloqasiz yoki to'liq bo'lmagan gapga mos aniqlashtiruvchi savol | Ssenariy va bankda mos javob bo'lmasa. Bir majlisda ko'pi bilan 12 marta |
| Iqtisodiy sud zali | **AI raqib advokat**: kutilmagan dalilga javob | Hamma darajada, tayyor javob bo'lmasa |
| «Ish yo'li» va DXM | **AI qahramon** (mijoz, navbatchi, tergovchi, kotib, fuqaro…) o'z rolida javob beradi va suhbatni bosqich maqsadiga qaytaradi | Tayyor vaziyat, variant va aniqlashtirish mos kelmasa |
| «Sohalar» | **Case qoralamasi**: oddiy so'z bilan yozilgan hikoyadan simulyatsiya ishi | Talaba yoki o'qituvchi «Case qo'shish» ni bossa. 45-95 s |
| «Bahs» | **Baholash**: 17 ta aniq band bo'yicha «ha / yo'q» va talaba gapidan iqtibos | Majlis tugagach. ~75 s |

### Nega hozir shu model

- **O'zbek tili sinovi (UzLiB):**
  - API modellar 0,78-0,85 ball oldi.
  - 8 GB GPU'ga sig'adigan mahalliy modellar 0,34-0,47 ball oldi (tasodifiy javob 0,25).
  
  Shuning uchun mahalliy LLM rad etildi.
- **Kattaroq mahalliy model:** Qwen3.6-35B-A3B (MoE) `llama.cpp` bilan ishlatish ko'rib chiqilgan. U hozir ishlatilmaydi.
- **Kamchilik:** AIHUB brauzer orqali ishlaydi, shuning uchun sekin (9-50 s) va `temperature` sozlanmaydi.
- **Barqarorlik:** bir xil so'rovga bir xil javob keshda saqlanadi.
- **Keyingi qadam** loyiha egasining qarori (E5): tez rasmiy API kaliti, masalan Gemini Flash yoki Groq. Kutilgan vaqt 2-4 s, lekin bu hali o'lchanmagan.

### AI javobi qanday nazorat qilinadi

AI'ning har bir javobini server tekshiradi. Tekshiruvdan o'tmagan javob **tashlanadi** va o'rniga tayyor gap aytiladi.

| Tekshiruv | Qoida |
|---|---|
| Raqamlar | Yangi raqam, summa yoki sana yo'q: faqat ish faktlaridagi va talaba gapidagi raqamlar |
| Moddalar | Faqat ruxsat etilgan ro'yxatdan. Ro'yxat bo'sh bo'lsa, modda umuman aytilmaydi |
| Hajm va til | 1-3 gap, kirill va so'kinish yo'q |
| Rol | Qaror chiqarmaydi, huquqiy maslahat bermaydi |
| Faktlar | Qahramon faqat o'ziga berilgan faktlardan gapiradi. Yo'q narsaga «bilmayman» deydi |
| Shaxsiy ma'lumot | Telefon, pasport, JSHSHIR, karta, e-pochta va Telegram username AI'ga yuborilishidan **oldin** yashiriladi |

**Ekranda ochiq aytiladi:** oldindan yozilmagan, AI aytgan har bir gap yonida kichik **«AI»** belgisi turadi.

### Javob berish tartibi (hamma xonada bir xil)

1. Qoidalar: so'kinish, rolni buzishga urinish, murojaat shakli.
2. Tanish vaziyatlar: «ishonchnoma uyda qoldi», «eshitmadim, qaytaring», ruscha gap va boshqalar.
3. Talaba tashabbusi: iltimosnoma, guvoh, e'tiroz.
4. Ssenariy va javoblar banki (ma'no bo'yicha moslash).
5. **AI**, faqat yuqoridagilar mos kelmasa.
6. Tayyor zaxira gap, agar AI ishlamasa yoki tekshiruvdan o'tmasa.

**«Qaytaring»:** bu iltimosga AI ishlatilmaydi. Qahramon oxirgi gapini xuddi o'sha ovoz bilan takrorlaydi.

### Sekin javob qanday ko'rsatiladi

- **«Ish yo'li»:** server javobni ~7 s kutadi. Javob hali yozilayotgan bo'lsa, qahramon «o'ylayapti…» deb ko'rsatiladi. Brauzer xuddi shu so'rovni qayta yuboradi va tayyor javob server keshidan keladi. 120 s ichida kelmasa, qahramon «tushunmadim, aniqroq ayting» deydi.
- **Sud zali:** sudya «sud tinglayapti» degan to'ldiruvchi gapni aytadi, AI javobi keyin keladi.
- **«Bahs»:** avval qoidalar bo'yicha dastlabki baho darhol e'lon qilinadi. Keyin sudya bahosi kelsa, u bilan almashtiriladi (120 s gacha).

---

## 3. Qonun bazasidan qidiruv (RAG)

| Nima | Qiymat |
|---|---|
| Korpus | lex.uz'dagi rasmiy matnlar, moddama-modda: FK, IPK, FPK, Mehnat kodeksi, JPK, JK, murojaatlar, davlat boji, advokatura qonunlari, OXS va Oliy sud Plenumlari |
| Hajm | 4 154 ta norma bo'lagi (`/health`, 21-noyabr) |
| Har bo'lakda | lex.uz havolasi (modda langari bilan), olingan sana, tahrir izohi, matn xeshi |
| Qidiruv | 1) bge-m3 embedding (ma'no) va so'z bo'yicha qidiruv birga; 2) reranker 30 nomzoddan eng mos 5 tasini tanlaydi |
| Chegara | Eng yaxshi natija bahosi **< 0,3** bo'lsa, «manba topilmadi» deyiladi va javob to'qilmaydi |
| O'lchov | ~0,9 s; reranker'siz Recall ~0,88 |

Frontendda ham alohida tekshirilgan to'plam bor (`legal/sources` → `src/data/sources.json`). Ssenariydagi har bir «N-modda» va Plenum bandi u bilan avtomatik test orqali solishtiriladi (`src/data/sources.test.ts`, `src/server/moot/econ.test.ts`).

---

## 4. Talaba gapini tushunish (NLU)

Talaba variant tanlamay, o'z so'zi bilan yozsa yoki gapirsa, `/nlu/match` gapni shu lahzaning javob variantlari bilan ma'no bo'yicha solishtiradi. Bu qismda **LLM ishlatilmaydi**: faqat embedding, reranker va qoidalar.

- **Mos variant topilsa,** gap shu javob hisoblanadi.
- **Ikki variant yaqin chiqsa,** taxmin qilinmaydi: qahramon aniqlashtirishni so'raydi.
- **Odatiy vaziyat bo'lsa** (so'kinish, mijozdan voz kechish, hujjat yo'qolgani, ruscha gap, kichik suhbat), har bir qahramon uchun tayyor, ovozlangan javob keladi.
- **Pora yoki tanish-bilishga ishora** etika buzilishi deb belgilanadi va jarimaga olib keladi.
- **Zaxira:** server javob bermasa, bizning ehtiyotkor so'z bo'yicha moslagichimiz ishlaydi (`src/lib/uz.ts`).

---

## 5. Nutqni matnga aylantirish (STT)

| Nima | Qiymat |
|---|---|
| Model | **Kotib**, GPU'da |
| Xato darajasi (WER), qisqa gaplar | 13 % → **7,8 %** (atama tuzatishlari bilan; 10 ta sintetik audio) |
| Muqobil sinov | rubaistt_v2: 26 % - shuning uchun Kotib tanlandi |
| Uzun nutq | 60 s gacha, bo'laklab (avval 15 s da kesilardi) |
| Sonlar | «besh yuz qirq to'rtinchi moddasiga» → «544-moddasiga» (11/11 test) |
| Tezlik | ~2,2 s / gap; jonli p50 ~2,9 s |
| Ishonch | STT ishonchi 0,5 dan past bo'lsa, gap baholanmaydi: qahramon qayta aytishni so'raydi |
| Zaxira | Brauzerning SpeechRecognition (`uz-UZ`), agar mavjud bo'lsa |

**Talaba nazorati:** tanilgan matn ekranda ko'rsatiladi, talaba uni tahrirlab yuboradi.

**«Bahs» baholashida:** ona tili va imlo xatosi uchun ball kesilmaydi.

---

## 6. Matnni nutqqa aylantirish (TTS)

| Yo'l | Model | Qachon |
|---|---|---|
| **Oldindan yozilgan gaplar** | **Chatterbox** (GPU) | Ssenariydagi barcha qat'iy gaplar oflayn yoziladi: 444 / 444 ta tayyor, keshdan beriladi |
| **Jonli gap** (AI aytgan, oldindan yozilmagan) | **Meta MMS** (VITS) | `/voice/tts` orqali, qahramon ovozi va kayfiyati bilan |
| **Zaxira** | Brauzerning o'zbekcha ovozi | Server bo'lmasa |

Lab harakati ovoz davomiyligiga moslanadi (`src/lib/visemes.ts`), ovoz bo'lmasa subtitr bo'yicha.

---

## 7. Baholash: ballni kim beradi

**Ballni AI bermaydi.** Ball uch bosqichda shakllanadi:

1. **Qoidalar (AI'siz).** Masalan: «Hurmatli sud» murojaati, so'kinish, manbasiz modda, berilgan har bir so'zda gapirgani.
2. **AI.** Faqat 17 ta aniq savolga «ha / yo'q / qo'llanmaydi» deb javob beradi. Har bir «ha» uchun **talabaning o'z gapidan iqtibos** keltiradi.
3. **Server.**
   - Iqtibosni bayonnomadan qidiradi. Topilmasa, band «bajarilmadi» hisoblanadi va ish mentorga ketadi.
   - Ballni hisoblaydi: bajarilgan bandlar og'irligi ÷ musbat og'irliklar yig'indisi × mezon maksimumi.
   - So'kingan tomonning jami bali 40 dan oshmaydi va u bahsda yuta olmaydi.

**«Bahs» mezonlari** (har biri xalqaro standartga bog'langan):

| Mezon | Og'irlik | Asos |
|---|---|---|
| Huquqiy asos | 30 | Jessup; SQE2 |
| Raqibga javob | 25 | Jessup; Vis; Berkeley |
| Faktlar va dalillar | 20 | Jessup; IPK 68 |
| So'zdan foydalanish | 15 | Vis; Berkeley |
| Sud odobi | 10 | IPK 167; advokat etikasi |

**Talaba ekranda ko'radi:**
- har bir mezon bo'yicha bandlar;
- o'z gapidan iqtibos;
- qaysi standartga tayanilgani;
- «Keyingi safar: …» maslahati.

**Nega AI'ga ball qo'ydirmaymiz.**
- Turli modellarning qattiqqo'lligi shkalaning 15-33 % iga farq qiladi.
- Model versiyasi o'zgarsa, baho sezilarli siljiydi.

Atomar bandlar va iqtibos talabi bu xatolarni kamaytiradi.

---

## 8. Uch bosqichli tekshiruv: tizim → AI → mentor

| Bosqich | Kim | Nima qiladi |
|---|---|---|
| 1 | Tizim | So'kinish, manbasiz modda, shaxsiy ma'lumot, raqam va modda tekshiruvi |
| 2 | AI | Bandlar bo'yicha baho, qahramon javobi, case qoralamasi. Shubhali ishni mentorga **o'zi yuboradi**: iqtibos topilmasa, yurishlar kelishmasa yoki etika buzilsa |
| 3 | Mentor | `/mentor` sahifasi: «Bahs baholari», «AI javoblari», «Statistika». Tasdiqlaydi, bandni tuzatadi yoki rad etadi |

- **Tasodifiy audit:** AI «yaxshi» degan ishlarning **3 %** i ham mentorga tushadi.
- **Oltin to'plam:** mentor qarorlari yig'iladi va AI bilan kelishuv o'lchanadi (Koen kappasi).
- **Maqsad:** κ ≥ 0,61. Buning uchun 30-50 ta bahsni mentorlar baholashi kerak.
- **Case'lar:** foydalanuvchi kiritgan ochiq case boshqalarga faqat mentor tasdiqlagandan keyin ko'rinadi.

---

## 9. Maxfiylik va xavfsizlik

- **Kalit:** sud serveri kaliti (`LEXSIM_REMOTE_KEY`) va mentor tokeni faqat bizning serverda saqlanadi, brauzerga hech qachon chiqmaydi.
- **Talabani aniqlash:** talaba sud serverida faqat tuzli xesh bilan tanilaydi, cookie'ning o'zi yuborilmaydi.
- **Shaxsiy ma'lumot** AI'ga yuborilishidan oldin yashiriladi. Logga talaba matni yozilmaydi.
- **Saqlash muddati:** majlis 7 kun, case 180 kun.
- **«Bahs»:** raqib tomonning maxfiy faktlari brauzerga umuman bormaydi. Haqiqiy sud natijasi bahs tugaguncha yashirin turadi.

---

## 10. Ochiq cheklovlar

1. **AI sekin** (AIHUB orqali). Rasmiy API kaliti kerak (E5).
2. **AI bahosi hali mentorlar bilan solishtirilmagan.** Navbat tayyor, mentorlar kerak.
3. **STT faqat sintetik ovozda o'lchangan.** Haqiqiy talabalardan 10-20 ta yozuv kerak.
4. **Litsenziya:**
   - **Meta MMS:** CC-BY-NC litsenziyasi, ya'ni tijoriy foydalanish mumkin emas.
   - **Kotib** va o'zbekcha **Chatterbox:** litsenziyasi hali tekshirilmagan.
5. **Reranker modelining aniq nomi** bu hujjatda ko'rsatilmagan. Sud serveri hujjatlarida faqat «reranker (GPU)» deb yozilgan.

---

## 11. Kodda qayerda (frontend)

| Nima | Fayl |
|---|---|
| Sud serveri bilan kalitli aloqa | `src/server/remote/key.ts` |
| Talaba gapini tushunish | `src/server/case/understand.ts`, `src/server/situation.ts`, `src/lib/uz.ts` |
| AI qahramon («Ish yo'li», DXM) | `src/server/case/npc.ts`, `src/server/case/engine.ts`, `src/server/engine/session.ts` |
| Sud zali (AI sudya va raqib) | `src/server/remote/court.ts`, `src/app/sud/[sessionId]/CourtSimClient.tsx` |
| «Bahs» bahosi | `src/server/moot/judge.ts`, `src/components/moot/Explain.tsx` |
| Case qoralamasi va yechimlar | `src/server/library.ts`, `src/components/library/` |
| Mentor tekshiruvi | `src/components/library/Audit.tsx`, `src/components/library/Mentor.tsx` |
| Ovoz (TTS/STT, zaxiralar, lab harakati) | `src/game/voice.ts`, `src/lib/visemes.ts` |

Batafsil manbalar va o'lchovlar: `docs/LexSim_Dalillar_va_Asoslar.md`, `docs/BACKEND_AI_ROADMAP.md`, `docs/METODIKA.md`.
