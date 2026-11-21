# LexSim — holat va reja

**Yangilangan:** 2026-11-21. Backend v1.4.2, frontend `main`.
**Kimlar uchun:** loyiha egasi, backend dasturchisi, mentor.

Bu **yagona boshqaruv hujjati**. Nima ishlayotgani, kim nima qilishi va qaysi tartibda — shu yerda. Backendning ochiq ishlari: **`LexSim_Backend_Vazifalar.md`** (doimiy yangilanadi). Batafsil texnik topshiriqlar ikkita faylda:
- `LexSim_Backend_Vazifalar_v14.md` — 10 ssenariy, ssenariy paketi, improvizatsiya, ovoz qatlamlari, sahna (`scene`);
- `LexSim_Backend_Vazifalar_v15.md` — ovozlar palitrasi, emotsiya va imo-ishora, yuridik tekshiruv varaqasi, "tirik" zal.

Eski javoblar va topshiriqlar `arxiv/` papkasida turadi, ular endi kerak emas.

---

## 1. Hozir ishlayapti (21-noyabr, jonli tekshirildi)

| Qism | Holat |
|---|---|
| Server `lex-api.e-investment.uz`, HTTPS, CORS | ✅ |
| Jonli sud: aniqlashtirish, savol, iltimosnoma, e'tiroz, kelishuv, vakolatsiz holat | ✅ 8/8 |
| To'liq oqim brauzerda, ikkala rol, uch daraja, hisobotgacha | ✅ xatosiz |
| Ovoz: sud zali 44, "Ish yo'li" 97 ta gap | ✅ hammasi keshda, 429 yo'q |
| STT GPU'da, status to'g'ri | ✅ (GPU yoniq bo'lsa) |
| Har bir gapda emotsiya va imo-ishora, tinglovchilar munosabati | ✅ keladi va zalda ijro etiladi |
| Kuchayib boradigan tanbeh (o'tirib gapirish, «Hurmatli sud» demaslik) | ✅ 1 → 2 → 3 |
| Terminal: bo'limlar, bosqichlar zanjiri, tasodifiy ish | ✅ |
| Har bir ish o'z sahnasida: aktyorlar, stoldagi hujjatlar, ekran | ✅ (10 tur uchun preset) |
| Amaliyot yozuvi: transkript, talabaning o'z ovozi, butun majlis audiosi, PDF, Word, WAV | ✅ |
| "Tirik" zal: turmagan talabaga hamma qaraydi, jimlikda sudya kutadi, kotib stolda ishlaydi | ✅ |
| Serverless (Netlify): DXM, raislik majlisi va "Ish yo'li" holati backend omboriga yoziladi va qayta o'qiladi | ✅ (kalit va B9 bilan) |
| Kalit Netlify'da | ✅ |
| Zaif qurilmalar: qurilma darajasi (low / medium / high), yengil modellar, 30 fps rejimi | ✅ |
| Ovozli javob: so'zlar jonli ko'rinadi, server sekin bo'lsa kutilmaydi, tushunilmasa aktyor qayta so'raydi | ✅ |

---

### Metodika va jinoyat ishi sudi (21-noyabr)

- **Metodika:** «Scenario-Based Experiential Legal Learning» 15 komponenti bilan solishtirildi (`LexSim_Metodika.md`). Qo'shildi: har xonada oldindan aytiladigan o'quv natijalari va ular bo'yicha baho; majburiy uch qismli refleksiya («Nima bo'ldi? Nega? Endi nima?»); ikkalasi bayonnoma va xAPI'da.
- **Jinoyat ishi endi hukmgacha:** 4-xona - jinoyat ishlari bo'yicha sud majlisi (JPK 424-473): sudya, kotib, davlat ayblovchisi, himoyachi, sudlanuvchi, jabrlanuvchi va vakili, guvoh. Talabaning ishi hukmni (ayblov yoki oqlov) belgilaydi.
- **Tuzatish:** ishora qiluvchi savol uchun JPK 114 emas, JPK 102. Fuqarolik ishida prokuror yo'qligi FPK 50 ga mos.

### Yangi (21-noyabr, mentorlar eʼtirozi boʻyicha)

- **Landing — yoʻnalish kartalari** (`/`): Advokat, Jabrlanuvchi vakili, Sudya, Iqtisodiy sud, DXM xodimi, Bahs. Har kartada 3D xonaning oʻzidan kadr va «Normativ asos». Karta → familiya, ism, jins, maqom → toʻgʻridan-toʻgʻri jarayonga. 3D kampus endi `/kampus`.
- **«Hujjatlar»** (avval «Hujjatlar xonasi»): tayyor variantlarni bosish oʻrniga — sud «Sudlar toʻgʻrisida»gi Qonun 2-moddasidagi sud tizimidan va hududdan **tanlanadi**, taraflar, manzillar, talab va holatlar **yoziladi**; advokat orderi rasmiy shakl (12 band) boʻyicha toʻldiriladi. Sud yozilganini ish papkasidagi hujjatlar bilan solishtiradi (FPK 189–191, 195). Sinov: `node tools/qa/draft.mjs`.
- **Normativ manbalar** (`/manbalar`): har yoʻnalish qaysi hujjat va moddalarga tayanadi — tahrir sanasi, lex.uz havolasi bilan. 8 ta yangi hujjat lex.uz dan yuklandi (`legal/README.md`, uchinchi bosqich). Koddagi har bir modda havolasi test bilan tekshiriladi.

### Yangi: «Bahs» — jamoaviy sud (21-noyabr)

- Ishlaydi (lokal server): `/bahs` — xona ochish/qoʻshilish, lobbi (A/B yoki qurʼa, 1×1–3×3), ish papkasi va maxfiy faktlar, 3D zalda navbatli majlis (14 qadam, taymer, ovoz yoki matn, jamoa chati, bayonnoma), qaror va yuklab olish.
- Sinov: `node tools/qa/moot.mjs` — ikki brauzer bilan toʻliq majlis, 11/11.
- **Netlify da hali ishlamaydi:** xona holati Next.js xotirasida. Backend koʻchirishi kerak — `backend-tasks/LexSim_Bahs_Backend.md`.
- Baho hozircha dastlabki (shakl va qamrov); mazmun bahosi backenddagi `/moot/judge` dan keyin.
- Ovoz — yozib yuboriladigan boʻlak (jonli emas); 3-oʻyinchilar zalda stol chetida oʻtiradi.

## 2. Kim nima qiladi

### 🔴 Loyiha egasi (siz) — boshqa ishlar shunga bog'liq

| # | Ish | Nima ochiladi |
|---|---|---|
| E1 | ✅ Kalit Netlify'da. Qoldi: `lexsim-web/.env.local` ga ham qo'yish (mahalliy sinov uchun) | — |
| E2 | **GPU kompyuter doim yoniq bo'lishi** (uxlash rejimi o'chirilsin). **21-noyabr sinovidagi "qotish" shundan edi:** STT CPU'da 15–40 s ishladi | Tez va aniq STT, klon ovozlar |
| E3 | **Ovoz namunalari va rozilik:** 3 sudya, 2 kotib, 4 vakil, 3 taraf, 2 guvoh; ayol ovozlari muhim | Har bir ish o'zgacha eshitiladi, ayol aktyorlar ayol ovozida gapiradi |
| E4 | **Mentor yoki huquqshunos** topib, 9 ta yangi ssenariyning huquqiy mazmunini yozdirish va imzolatish | 10 ta ish (format va tekshiruvchi tayyor) |
| E5 | **Tez LLM API kaliti** (Gemini Flash yoki Groq) | `advanced` darajada erkin nutqqa 1–3 s javob (hozir 7–20 s) |
| E6 | **Yozuvlarni saqlash siyosati:** muddat (taklif — 180 kun), shifrlash kaliti, o'chirish tartibi | O'qituvchi panelida talabalar yozuvi (`POST /records`) |

### 🟠 Backend dasturchisi — batafsil: `LexSim_Backend_Vazifalar.md`

| # | Ish | Qayerda batafsil |
|---|---|---|
| B1 | **Tik turish holati noma'lum bo'lsa, tanbeh ishlamaydi.** Talaba G'ni hech bosmasa, `standing` `null` bo'lib qoladi va sudya hech qachon tanbeh bermaydi. `sit-at-desk` dan keyin standart holat `false` bo'lsin. (Frontend vaqtincha zalga kirishda `sit` yuboradi.) | — |
| B2 | **Yangi signallarni ishlatish.** Siz so'ragan "kim gapiryapti" signali tayyor, pastdagi 3-bo'limga qarang. Gap bo'lish, raqib gapirganda tik turish va 90 s dan uzun nutq uchun tanbeh zinapoyasiga ulang | v15 7.2, 7.4 |
| B3 | STT GPU'da ≤ 2,5 s (hozir ~4 s, tunnel sababli) | v15 1.2 |
| B4 | Palitra kelgach: `scene.voices`, emotsiya variantlarini render qilish | v15 2 |
| B5 | Mentor paketi kelgach: 9 ssenariy, linterga sana va summa tekshiruvi, qaror qoidalari | v14 1, 7; v15 4 |
| B6 | E5 dan keyin: improvizatsiya ≤ 3 s, «qisqa bo'lak + tayyor javob», jonli gap klon ovozda | v14 2, 5 |
| B7 | E6 dan keyin: `POST /records`, `GET /teacher/records` | v15 5 |
| B8 | `npcTurn.audio = {id, durationMs}` | v14 5.6 |
| B9 | Ombor: `dxm-session` va `hearing` hujjatlari, muddat, limit, egasi tekshiruvi (serverless uchun) | v16 |

### 🟢 Frontend — keyingi navbat

| # | Ish |
|---|---|
| F1 | E1 dan keyin: kalitli yo'llarni (NLU, saqlash, xAPI, har xonada ovoz) jonli sinash va hisobot yozish |
| F2 | B7 dan keyin: «O'qituvchiga yuborish» tugmasi, rozilik oynasi |
| F3 | ✅ Kotib stolda ishlaydi. Qoldi: zalning yengil fon tovushi (ovoz fayli kerak) |
| F4 | ✅ Redis kerak emas: holat backend omboriga yoziladi (kalit kelishi bilan ishlaydi; B9) |
| F5 | Har bir yangi ssenariy kelganda: sahna, ovozlar va hujjatlarni ko'rib chiqish, QA |

### 🔵 Mentor

| # | Ish |
|---|---|
| M1 | 9 ta yangi ssenariy: faktlar, dalillar, moddalar (faqat bazadan), ideal yo'l, qaror qoidalari |
| M2 | Har bir ssenariy uchun tekshiruv varaqasini imzolash (v15 4.5) |
| M3 | Ishlatilayotgan moddalarga `verifiedAt` qo'yish; tartib buzilishi choralari uchun moddalar (v15 7.2) |

---

## 3. Backend so'ragan signal — tayyor (v1.4.2 «Sizdan kerak», 3-band)

**Frontend kafolati:** talabaning javobi faqat oldingi barcha gaplar oxirigacha eshitilgandan keyin yuboriladi. O'yinchi NPC gapirayotganda javob yuborishga ruxsat bermaydi.

**`POST /sessions/{id}/turns`** — yangi `presence` maydoni:
```json
{ "clientTurnId": "…", "text": "…", "inputMode": "voice",
  "presence": { "heardTurnId": "t_41", "spokenSeconds": 94.2, "standing": false } }
```
- `heardTurnId` — talaba oxirigacha eshitgan oxirgi gap;
- `spokenSeconds` — ovozli javob davomiyligi (90 s chegarasi uchun);
- `standing` — javob paytidagi holat.

**`POST /sessions/{id}/interactions`** (`stand` / `sit`) — yangi `context` maydoni:
```json
{ "clientActionId": "…", "action": "stand", "context": { "during": { "turnId": "t_42", "role": "opponent" } } }
```
Bu maydon talaba turgan yoki o'tirgan paytda kim gapirayotganini bildiradi: «raqib gapirayotganda tik turdi».

Ikkalasi ham hozir serverga yuborilmoqda va `200` qaytadi. To'liq sxema: `contracts.schema.json`.

---

## 4. Tartib (qaysi ketma-ketlikda)

1. **E1** — kalit va **E2** — GPU doim yoniq. Bu bugun.
2. **B1, B2** — kichik, darhol.
3. **E4 → M1, M2 → B5 → F5** — ssenariylar. Eng uzun yo'l, shuning uchun mentorni hoziroq toping.
4. **E3 → B4** — ovozlar palitrasi.
5. **E5 → B6** — tez improvizatsiya.
6. **E6 → B7 → F2** — o'qituvchi paneli.
7. **F4** ✅ qilindi. Kalit va B9 bilan Netlify'da ham barqaror.

---

## 5. Tekshirish buyruqlari (frontend repo, `lexsim-web`)

```bash
curl -s https://lex-api.e-investment.uz/api/v1/health      # version, voice.gpu, coverage
node tools/qa/live.mjs                                      # jonli sud, 8/8
node tools/qa/voice-coverage.mjs                            # FAIL 0, rate-limited waits 0
node tools/qa/economic.mjs                                  # brauzerda to'liq oqim, konsolda xato yo'q
```

**Backendga beriladigan fayllar:**
- `LexSim_Backend_Vazifalar.md` (ochiq ishlar);
- shu hujjat;
- `LexSim_Backend_Vazifalar_v14.md`;
- `LexSim_Backend_Vazifalar_v15.md`;
- `contracts.schema.json`;
- `lines.json`.
