# LexSim — backend uchun vazifalar (v1.4 to'liq tekshiruvdan keyin)

**Kimga:** backend dasturchisi.
**Sana:** 2026-11-21.
**Server:** `https://lex-api.e-investment.uz/api/v1` (1.4.0).

Bu hujjat oldingi [LexSim_Frontend_v14_Javob.md](LexSim_Frontend_v14_Javob.md) o'rnini bosadi, unda yozilganlarning hammasi shu yerda bor.

Hammasini frontend bilan birga, haqiqiy talaba yo'li bo'yicha sinadik:
hub → sud → gap → ovoz → hisobot, ikkala rol va uch daraja.

---

## 0. Umumiy xulosa

**Ishlaydigan qismlar:**
- sud oqimi;
- jonli sud;
- hisobot (frontend vaqtinchalik moslash bilan);
- tezlik.

**Asosiy yangi vazifa:** ~10 ssenariy va erkin nutqqa improvizatsiya (alohida bo'lim, P0 dan keyin).

**Talaba ovozni to'liq eshitishi va ovoz bilan javob berishi uchun:** P0 dagi uchta ish bajarilishi kerak. Hozir talabaning gapi umuman tanilmaydi. "Ish yo'li" xonalarida gaplarning 80 % i ovozsiz chiqadi.

| Qism | Holat |
|---|---|
| Sud oqimi: ikkala rol, `beginner`/`intermediate`/`advanced`, hisobotgacha | ✅ |
| Jonli sud: aniqlashtirish, raqibga savol, iltimosnoma, keyinga qoldirish, kelishuv, vakolatsiz → `report-ready` | ✅ |
| Jonli sud: e'tiroz | ❌ P1-2 |
| Javob tezligi, matn bilan | ✅ 0,1–1,3 s (ba'zan 6–11 s, P1-5) |
| **STT (talaba ovozi)** | ❌ **P0-1: umuman ishlamayapti** |
| **TTS, sud zali** | ⚠️ 41 gapdan 35 tasi ovozli, 6 tasi ovozsiz (P0-2) |
| **TTS, "Ish yo'li" xonalari** | ❌ **97 gapdan 19 tasi ovozli, 78 tasi ovozsiz (P0-2)** |
| Hisobot kontrakti | ⚠️ `decisions[].points: null` (P1-1) |
| Kalitli API (NLU, store, xAPI, hamma xonada ovoz) | ⏳ kalit yo'q (P0-3) |

**Tekshirish uchun repodagi skriptlar** (`lexsim-web` ichida):
- `node tools/qa/voice-coverage.mjs` — har bir gap ovoz bo'lib qaytadimi; to'g'ridan-to'g'ri sizning serverga ulanadi, kalit kerak emas;
- `node tools/qa/live.mjs` — jonli sud (bizning dev server orqali);
- `node tools/qa/economic.mjs` — to'liq oqim brauzerda, hisobotgacha.

---

## P0 — ovoz (shusiz "tabiiy" bo'lmaydi)

### P0-1. STT ishlamayapti

```
GET  /voice/status  → {"tts":"server","stt":null,"sttEngine":"gpu",...}
POST /voice/stt     → 504 {"error":{"code":"voice_timeout","message":"Ovoz xizmati javob bermadi (FileNotFoundError)"}}
```

Test uchun 16 kHz mono WAV yubordik, `lexsim_owner` cookie bilan.

**Muammo:**
- GPU STT o'chiq;
- hujjatda aytilgan CPU zaxirasi ham ishlamayapti, `FileNotFoundError` chiqyapti.

Ehtimol, serverni ko'chirishda model fayllari yoki yo'llari yangi serverga o'tmagan.

**Bizda hozir nima bo'lyapti:** talaba mikrofonni bossa, brauzerning o'z tanishiga o'tamiz. U faqat Chrome'da ishlaydi va sifati past.

**Kerak:**
1. GPU STT'ni qayta ulang (tunnel yoki xizmat).
2. CPU zaxirasining model fayllarini yangi serverga qo'ying.
3. `/voice/status` faqat haqiqatan ishlayotgan dvigatelni qaytarsin (`"stt":"gpu"` yoki `"cpu"`).

**Qabul mezoni:**
- 5 s audio → 200 va matn: GPU'da ≤ 2,5 s, CPU'da ≤ 40 s;
- `/voice/status` → `stt` `null` emas.

### P0-2. TTS keshi yo'qolgan, keshda yo'q gap uchun ovoz yo'q

`node tools/qa/voice-coverage.mjs` natijasi:

```
court lines 41  hit 35  FAIL 6
case lines  97  hit 19  FAIL 78       ← v1.4 hujjatida «97 ✅ tayyor» deyilgan edi
```

Keshda yo'q **har qanday** gap: `504 voice_timeout (FileNotFoundError)`. MMS zaxirasi ham ishlamayapti.

Ovoz qaytmasa, talaba sudyani **jim** ko'radi, faqat subtitr chiqadi. Ko'p kompyuterlarda o'zbekcha brauzer ovozi yo'q.

Ovozsiz qolgan sud zali gaplaridan misollar (live-procedure gaplari):
- [judge] «Daʼvogar vakili, talabingizni aniqlashtiring: qaysi shartnoma asosida, qancha summani va qaysi huquqiy asosda undirishni soʻrayapsiz?»
- [opponent] «Hurmatli sud, joydan taxminan uch oy foydalanganmiz, keyin chiqib ketganmiz.»
- [opponent] «Hurmatli sud, iltimosnomaga qarshimiz: ishda yetarli yozma dalillar bor.»
- [opponent] «Hurmatli sud, hozircha kelishuv bitimiga rozi emasmiz, avval penya masalasi koʻrib chiqilsin.»
- [judge] «Daʼvogar vakili, iltimosnomaga aniq munosabat bildiring: penyani kamaytirishga rozimisiz…»
- [judge] «Javobgar vakili, nutqingizni yakunlang: tekshirilgan dalillar asosida suddan aniq nimani soʻraysiz…»

**Kerak:**
1. Eski serverdagi TTS keshini yangi serverga ko'chiring. Agar uni o'chirib yuborgan bo'lsangiz, qayta render qiling.
2. **Yangilangan** `lines.json` ni qayta prerender qiling (ilova qilingan, 97 gap, `voice` maydoni bilan). Bitta gap o'zgardi: sahna izohi `(sekin)` endi matnda yo'q, biz uni ovozga yubormaymiz.
3. v1.4 hujjatidagi 64 ta jonli sud gapini, ularning barcha variantlarini va rol nomli shablonlarni prerender qiling.
4. MMS zaxirasini tuzating: keshda yo'q har qanday gap 200 va audio bilan ≤ 2,5 s da qaytsin.
5. Yangi gap qo'shganingizda prerender ro'yxatiga avtomatik tushsin.

**Qabul mezoni:** `voice-coverage.mjs` hamma joyda `FAIL 0` ko'rsatsin. Sud zali va "Ish yo'li" gaplari hammasi `hit` bo'lsin.

### P0-3. `LEXSIM_REMOTE_KEY`

Kalitsiz sizning ovozingiz faqat sud zalida ishlaydi, chunki u yerda talabaning cookie'si bor. "Ish yo'li" xonalari va DXM'da talaba hech qachon server ovozini eshitmaydi: 97 ta gap prerender qilingan bo'lsa ham ishlatilmaydi. NLU, ishni saqlash va xAPI ham faqat kalit bilan ishlaydi.

**Kerak:** kalitni loyiha egasiga **shaxsan** bering, chatda emas. Kalitni u Netlify'ga va `.env.local` ga o'zi qo'yadi.

**Qabul mezoni:** kalit bilan barcha xonalarda `GET /api/v1/voice/status` → `tts:"server"` bo'lsin. Buni biz tekshiramiz.

### P0-4. Ayol rollari (ma'lum, eslatma)

Kotib va raqib advokat hozir erkak ovozida gapiradi. Ayol ovozi namunalari kelgach klonlang va prerender'ni shu ovozlar uchun qayta ishga tushiring.

---

## ASOSIY YANGI VAZIFA — ~10 ssenariy va erkin nutqqa improvizatsiya

### Maqsad

Platformada ~10 ta tayyor sud ssenariysi bo'ladi. Talabaga ulardan biri tasodifiy tushadi.

Talaba variant bosmaydi. U xohlagancha **o'zi gapiradi yoki yozadi**: chala, tartibsiz, uzun, mavzudan chetga chiqib.

Sudya va raqib bunga tirik odamdek javob beradi. Ular ssenariy asosida improvizatsiya qiladi, lekin **ssenariyni tubdan o'zgartirmaydi**:
- faktlar, dalillar va bosqichlar o'z joyida qoladi;
- to'g'ri huquqiy yechim ham o'zgarmaydi.

**Asosiy qoida: ssenariy — qonun, model — aktyor.** Nima sodir bo'lishini deterministik dvigatel hal qiladi. Model faqat buni **qanday aytishni** yozadi.

### 1. Ssenariy paketi (har bir ish uchun bitta fayl)

Hozirgi `sud-ijara-*` ni shu formatga o'tkazing, qolgan 9 tasini ham shu formatda yozing:

| Blok | Nima bor | Nega kerak |
|---|---|---|
| `meta` | `id`, `title`, `court` (iqtisodiy/fuqarolik), `roles` (da'vogar/javobgar), `durationMinutes`, `difficulty`, `tags`, `summary` | Hub kartasi, tasodifiy tanlash |
| `briefing` | `workplace`, `position`, `authority[]`, `task[]`, `secret[]` | Talabaga beriladigan topshiriq. `secret` boshqa tomonga hech qachon aytilmaydi |
| `facts[]` | `id`, `text`, `status`: `undisputed` / `disputed` / `hidden`, `revealWhen` (qaysi savol yoki mavzu ochadi) | Model **faqat shu faktlar** bilan gapiradi |
| `evidence[]` | `id`, `title`, `proves[factId]`, `weakness` | Dalillar bosqichi, e'tirozlar |
| `persona` | sudya: qat'iylik, ohang. Raqib: strategiya, `mayConcede[]` (nimani tan olishi mumkin), `neverConcede[]`, kelishuv sharti. Guvohlar, agar bo'lsa | Raqib har gal boshqacha, lekin bir xil xarakterda |
| `stages[]` | IPK bo'yicha bosqich: maqsad, talab qilinadigan elementlar, ruxsat etilgan harakatlar, o'tish shartlari | Protsess skeleti, model o'zgartirmaydi |
| `keyMoments[]` | KM1… : kutilgan dalil, `articleIds` (normalar bazasidan), namuna javob | Baholash va "Qanday aytish kerak edi" bloki |
| `outcome` | Qaror funksiyasi: talaba nimani isbotladi → qanday qaror (to'liq, qisman, rad) | Natijani model emas, talabaning ishi belgilaydi |
| `lines` | Sudyaning kanonik gaplari va har biriga 2–3 variant | Prerender: tez va bir xil ovoz |
| `variables` | Tasodifiylashtiriladigan qiymatlar: ismlar, summa, sana, shartnoma raqami. Har biri uchun ruxsat etilgan oraliq beriladi | Bir ish 2-marta o'ynalganda ham yangidek tuyuladi. Sessiya ichida `seed` bilan qat'iy bo'ladi |

**Moddalar:**
- faqat sizning normalar bazangizdan olinadi (2267 ta norma, `articleId` bilan);
- har bir moddaga mentor `verifiedAt` qo'yadi;
- ssenariyda bazada yo'q modda bo'lsa, ssenariy ishga tushmaydi.

### 2. Har bir navbatda nima sodir bo'ladi

```
Talaba gapi (STT yoki matn)
 1. Tushunish (qoidalar + NLU + reranker):
    - harakat turi: javob / savol / iltimosnoma / e'tiroz / kelishuv / chetga chiqish / haqorat / pora;
    - talabaning da'volari: summa, modda, qaysi dalil, qaysi fakt.
 2. DVIGATEL (deterministik, yagona hakam):
    - bosqich, ochilgan faktlar, ball, sud ajrimi, keyingi so'z navbati;
    - "rejissyor kartasi"ni tuzadi: kim gapiradi, maqsad (masalan: «F3 ni rad et, E2 ga tayan,
      hech narsani tan olma»), ruxsat etilgan faktlar, taqiqlar, uzunlik ≤ 2 gap.
 3. MODEL (aktyor): faqat kartadagi maqsadni o'z so'zi bilan aytadi.
    Chiqishi JSON: {text, usedFactIds, articleIds}.
 4. QO'RIQCHI (validator) — talabaga yetib borishidan oldin:
    - kartada yo'q fakt, summa, sana yoki ism bormi;
    - ruxsat berilmagan modda bormi;
    - sudya betarafmi; uzunlik qancha; lotin imlosi va ʻ/ʼ to'g'rimi;
    - "bosqich tugadi" yoki "qaror chiqdi" degan uydirma bormi.
    Xato bo'lsa: 1 marta qayta urinish → keyin bankdagi tayyor javob. Hech qachon to'xtab qolmaydi.
 5. XOTIRA: raqib nimani tan oldi, nima dedi. Keyingi gaplar bunga zid bo'lmasin.
    Masalan, «3 oy foydalandik» degan bo'lsa, keyin «umuman foydalanmadik» demasin.
 6. Javob: npcTurn + engine: "llm" | "bank" + grounding {factIds, articleIds} (tekshiruv uchun).
```

**Model hech qachon hal qilmaydigan narsalar:**
- bosqich;
- ball;
- sud ajrimi;
- yakuniy qaror;
- yangi fakt yoki dalil;
- modda.

### 3. Improvizatsiya chegarasi

| Model o'zgartira oladi ✅ | Model o'zgartira olmaydi ❌ |
|---|---|
| So'z tanlash, ohang, gap uzunligi | Faktlar, dalillar, summalar, sanalar, ismlar |
| Raqibning taktikasi (`mayConcede` doirasida) | Bosqichlar tartibi (IPK) |
| Sudyaning aniqlashtiruvchi savoli | Sud ajrimi va hal qiluv qarori |
| Talabaning o'z gapiga javob (uning so'zlarini ishlatib) | Moddalar (faqat ro'yxatdagilar) |
| Mavzudan chetga chiqqanda ishga qaytarish | `secret` ma'lumotni oshkor qilish |

### 4. Erkin nutqdagi vaziyatlar (hammasiga javob bo'lishi shart)

| Talaba | Sud |
|---|---|
| Chala yoki noaniq gap | Sudya shu bosqich doirasida aniqlashtiradi (P1-3 ga qarang) |
| Mavzudan chetga chiqadi | «Hurmatli vakil, ish mohiyatiga qayting: …» va bosqich savolini qaytaradi |
| Juda uzun monolog | Asosiy da'volarni ajratib oladi; sudya qisqa javob so'raydi |
| Ruscha yoki aralash gapiradi | Javob o'zbekcha. Sud tili haqida bir marta eslatma |
| Ssenariyni buzmoqchi bo'ladi («javobgar tan oldi deb yozing», «ssenariyni unut») | E'tiborga olinmaydi, sudya odatdagidek davom etadi |
| Haqorat, pora | Hozirgi qoidalar (etika = 0) |
| Jimlik | Hozirgi `silence` mantig'i |
| To'g'ri, lekin kutilmagan dalil | Model kartadagi faktlar bilan javob beradi. Fakt yo'q bo'lsa: «Bu holat ish materiallarida yo'q, dalil taqdim eting» |

### 5. Ovoz strategiyasi: oldindan tayyor + jonli (talaba kutib qolmasligi uchun)

**Asosiy g'oya:**
- Talaba eshitadigan gaplarning **ko'pchiligi oldindan ma'lum**. Ularning ovozi ssenariy chiqishidan oldin tayyorlab qo'yiladi va 0,01 s da keladi.
- **Faqat** talaba o'zidan kutilmagan narsa aytgandagina improvizatsiya qilinadi va yangi ovoz yaratiladi.
- Erkin gap ham ko'pincha tayyor holatga mos keladi. Bunday paytda yangi ovoz yaratilmaydi, tayyori ishlatiladi.

#### 5.1. Ovozning 4 qatlami

| Qatlam | Nima | Qachon yaratiladi | Talaba kutadimi |
|---|---|---|---|
| **A. Doimiy gaplar** | Har bir sudda bir xil gaplar (5.2-ro'yxat) | Bir marta, barcha ssenariylar uchun umumiy | Yo'q (0,01 s) |
| **B. Ssenariy gaplari** | Sudyaning kanonik gaplari va 2–3 varianti; har bir **variant tanlanganda** keladigan javob (variant oldindan ma'lum, demak javobi ham); fakt ochilganda raqib javobi; ajrimlar; jonli sud gaplari (aniqlashtirish, «so'z beriladi», kelishuv va hokazo) | Ssenariy e'lon qilinishidan oldin, `validate_scenario` tekshiradi | Yo'q |
| **C. Javoblar banki** | Raqib, sudya va guvohning umumiy tayyor javoblari (hozir 57 ta, ko'payadi) | Oldindan | Yo'q |
| **D. Jonli improvizatsiya** | A–C da mos gap topilmagan erkin nutqqa model yozgan yangi gap | Shu zahoti | ≤ 3 s matn + ≤ 1,5 s birinchi ovoz |

**Qabul mezoni:** oddiy sessiyada talaba eshitadigan gaplarning **≥ 90 %** i A–C qatlamdan bo'lsin, ya'ni `X-TTS-Cache: hit`. Bu ko'rsatkichni `/monitor` da ko'rsating.

#### 5.2. Doimiy gaplar (A qatlam) — majburiy ro'yxat

Bular ssenariyga bog'liq emas. Hammasi rolning o'z ovozida tayyor turishi kerak.

**Kotib** (`female`):
- «Sud kirib kelmoqda, oʻrningizdan turing!»;
- «Sud majlisiga taraflarning vakillari kelgan.» va kelmagan taraf variantlari;
- «Sud majlisi bayonnomasi yuritilmoqda.».

**Sudya** (`elder_m`):
- «Oʻtiring.»;
- «Sud majlisi ochiq deb eʼlon qilinadi.» (umumiy qismi);
- «Sudga oʻrningizdan turib murojaat qiling.»;
- «Sudga «Hurmatli sud» deb murojaat qiling.»;
- «Javobingizni qisqa va aniq bayon qiling.»;
- «Ish mohiyatiga qayting.»;
- «Savolni takrorlayman.»;
- jimlik eslatmalari («Sud javobingizni kutmoqda.» va boshqalar);
- «Soʻz … vakiliga beriladi.» (da'vogar va javobgar uchun alohida);
- «Sud joyida maslahatlashib, ajrim chiqardi: iltimosnoma qanoatlantirilsin / rad etilsin.»;
- «Eʼtiroz qabul qilindi / rad etildi.»;
- «Qoʻshimcha materiallar bormi?»;
- «Sud muzokaralariga oʻtiladi.»;
- «Sud hal qiluv qarorini qabul qilish uchun maslahatxonaga kiradi.»;
- «Hal qiluv qarori bir oy oʻtgach qonuniy kuchga kiradi…»;
- «Sud majlisi yopiq deb eʼlon qilinadi.»;
- odob buzilishiga reaksiyalar (haqorat, pora, gapni bo'lish).

**Raqib** (`female_alt`):
- «Hurmatli sud, rad bildirmaymiz.»;
- «Huquqlarimiz tushunarli, hurmatli sud.»;
- «Hurmatli sud, iltimosnomamiz yoʻq.»;
- «Eʼtirozimiz bor, hurmatli sud.»;
- qisqa rozilik yoki inkor gaplari.

**Qisqa "o'ylash" gaplari** (sudya va raqib uchun):
- misollar: «Tushunarli.», «Bir daqiqa.», «Hm, aniqlashtiraylik.», «Hurmatli sud, bir lahza.»;
- 5.4-bandda ishlatiladi.

**Ism, summa yoki sana bor gaplar** keshni buzmasligi uchun 2 yo'ldan birini tanlang:
1. gapni doimiy bo'lak va o'zgaruvchi bo'lakka ajrating; ikkala bo'lak ham tayyor bo'lsin (masalan, summalar ro'yxati);
2. ssenariyning har bir `seed` varianti uchun alohida render qiling. Buning uchun `variables` sonini cheklang: har ssenariyga 3–5 ta seed.

#### 5.3. Erkin gapni tayyor ovozga moslash (yangi ovoz yaratmasdan)

Talaba variant bosmasdan o'z so'zi bilan gapirdi, lekin ma'nosi biror variantga yoki tayyor holatga mos keladi. Unda:

1. NLU yoki reranker talabaning gapini shu bosqich variantlari va bank bilan solishtiradi.
2. **Ishonch yuqori bo'lsa** (chegara ssenariy bo'yicha sozlanadi): tayyor javob va uning tayyor ovozi ishlatiladi, model chaqirilmaydi.
3. **Ishonch o'rtacha bo'lsa:** tayyor javob ishlatiladi, model faqat uning boshiga talabaning so'zlariga ishora qiluvchi qisqa bo'lak qo'shadi. Masalan: «Siz aytgan hisob-fakturalar masalasiga kelsak…». Faqat shu kichik bo'lak jonli render qilinadi.
4. **Mos kelmasa:** D qatlam, to'liq improvizatsiya.

Shunda erkin gapiradigan talaba ham ko'p hollarda kutmaydi.

#### 5.4. Jonli improvizatsiya kutishni yashirish

Model va TTS ishlayotgan vaqtda (1–3 s) zal jim qolmasin:
- tayyor «o'ylash» gapi (5.2) **darhol** alohida `npcTurn` bo'lib yuboriladi, keyin asosiy improvizatsiya keladi;
- bitta sessiyada uni har 3 navbatda 1 martadan ko'p ishlatmang, aks holda sun'iy eshitiladi;
- javob 0,8 s dan tez tayyor bo'lsa, «o'ylash» gapi kerak emas.

#### 5.5. Jonli ovoz talablari (D qatlam)

- Model javobi p95 ≤ 3 s. Hozirgi 60–110 s to'g'ri kelmaydi: tez API (Groq, Gemini Flash yoki boshqa) va oqim (stream) rejimi kerak.
- Yangi gap **o'sha klonlangan ovozda** chiqsin: Chatterbox, birinchi audio ≤ 1,5 s, uzun gap bo'lsa gapma-gap. Boshqa ovozdagi MMS faqat oxirgi chora.
- Yaratilgan har bir jonli gap keshga yozilsin. Tez-tez qaytadigan gaplarni mentor ko'rib chiqib, bankka (C) o'tkazsin. Shunda tizim vaqt o'tishi bilan tezlashadi.

#### 5.6. Frontend tomonda nima tayyor

- Sud bir nechta gapni ketma-ket aytsa (kotib → sudya → raqib), keyingi 3 ta gapning ovozi birinchisi ijro etilayotganda **oldindan yuklanadi**. Spikerlar orasida pauza qolmaydi.
- Matn TTS'ga aynan `npcTurn.text` ko'rinishida ketadi. Faqat boshidagi sahna izohi `(…)` olib tashlanadi. Prerender kaliti shu matn bo'lsin.
- Oqimli TTS (`/voice/tts/stream` yoki gaplar bo'yicha) bersangiz, bo'laklarni birin-ketin ijro etamiz.
- `X-Word-Timings` haqiqiy bo'lsa, lab harakatiga ulaymiz.
- **Ixtiyoriy, lekin foydali:** prerender qilingan gap uchun `npcTurn.audio = {id, durationMs}` qo'shing. Shunda biz ovozni javob bilan bir vaqtda so'raymiz.

### 6. Tasodifiy tanlash va kontrakt

**Frontendda tayyor:**
- hub'dagi ssenariylar `GET /scenarios` dan dinamik chiqadi, 10 ta bo'lsa 10 tasi ham ko'rinadi;
- «Tasodifiy ish» tugmasi qo'shildi, oxirgi 3 ta ish takrorlanmaydi.

**Sizdan (qo'shimcha maydonlar, `protocol: 1` buzilmaydi):**
- `GET /scenarios`: `court`, `difficulty`, `tags`, `summary` maydonlari;
- `POST /sessions`: ixtiyoriy `seed`. Bo'lmasa, o'zingiz yaratasiz va `snapshot.seed` da qaytarasiz. Shunda hisobot va qayta o'ynash bir xil bo'ladi;
- `npcTurn.engine`: `"llm"` | `"bank"` | `"script"` va ixtiyoriy `grounding`. Biz faqat ko'rsatamiz yoki log qilamiz.

### 7. 10 ta ssenariyni yozish

**Kim yozadi:**
- huquqiy mazmunni (faktlar, dalillar, moddalar, qaror funksiyasi) mentor yoki huquqshunos yozadi va tasdiqlaydi;
- siz format, dvigatel va prerender bilan shug'ullanasiz.

**Mavzu takliflari** (moddalarni mentor bazadan tanlaydi, biz modda yozmaymiz):
1. ijara qarzi va penya (bor);
2. yetkazib berish shartnomasi: to'lanmagan tovar;
3. pudrat: ish sifati va qabul dalolatnomasi;
4. xizmat ko'rsatish: bajarilmagan xizmat;
5. qarz (zayom) shartnomasi;
6. sug'urta to'lovini undirish;
7. lizing to'lovlari;
8. shartnomani bekor qilish va zararni undirish;
9. kafillik yoki kafolat bo'yicha talab;
10. ma'muriy hujjat ustidan nizo (soliq yoki hokimiyat qarori).

Har birida ikkala rol bo'lsin.

**Ssenariy linteri** (`validate_scenario`) har bir ssenariyni ishga tushirishdan oldin tekshiradi:
- har bir `articleId` bazada bormi;
- har bir fakt kamida bitta bosqich yoki dalilga bog'langanmi;
- har bir bosqichga yetib borish mumkinmi;
- `outcome` barcha holatlarni qamraydimi;
- barcha `lines` prerender qilinganmi;
- `variables` o'rnatilganda summalar mos keladimi.

### 8. Qabul testlari

1. **Oltin transkriptlar.** Har ssenariy va har rol uchun 3 ta: `beginner`, `advanced` yaxshi va `advanced` yomon. Natija (qaror, ball oralig'i) har ishga tushirishda bir xil chiqsin.
2. **Ovoz qamrovi.** Har ssenariyning to'liq o'yinida ≥ 90 % gap keshdan, A va B qatlam gaplari 100 % tayyor (`voice-coverage.mjs`).
3. **Hujum to'plami.** Har ssenariyga 50 ta erkin gap: chetga chiqish, injection, haqorat, ruscha, uzun, bo'sh. Natija:
   - **0 ta uydirma fakt yoki modda**;
   - 0 ta bosqich buzilishi;
   - sudya betarafligi buzilmasin.
4. **Barqarorlik.** Bir xil gaplar bilan 10 marta o'ynalsa, so'zlar har xil bo'lishi mumkin, lekin bosqichlar, ajrimlar va qaror bir xil bo'lsin.
5. **Tezlik.** Matn javobi p95 ≤ 3 s; birinchi ovoz ≤ 1,5 s; `voice-coverage.mjs` kanonik gaplarda `FAIL 0`.
6. **Frontend bilan.** `tools/qa/live.mjs` va `economic.mjs` har ssenariyda o'tsin. Biz ularni `scenarioId` parametri bilan kengaytiramiz.

---

## P1 — sud mantig'i va kontrakt

### P1-1. Hisobot: `decisions[].points` `null` keladi

v1.4 dagi yangi harakatlar (iltimosnoma, savol, kelishuv) `points: null` bilan yoziladi. Bizning kontraktimizda bu maydon `number`, natijada javobgar rolining hisoboti `remote_contract` xatosi bilan ochilmay qoldi:

```
decisions[6].points: expected number, received null   (shuningdek 9, 11)
```

Biz frontendda `null` ni vaqtincha `0` deb qabul qildik. **Kerak:** ball bo'lmasa, `0` yuboring. `contracts.schema.json` bo'yicha test yozing, bunday maydonlar qayta chiqmasin.

### P1-2. Sudyaning savoli ochiq turganda e'tiroz tanilmayapti

**Takrorlash:**
1. To'liq da'vo bayon qilinadi.
2. Raqib «dalolatnoma yo'q» deydi.
3. Sudya «…munosabatingiz?» deb so'raydi.
4. Talaba: «Hurmatli sud, javobgar vakilining gapiga eʼtiroz bildiraman, chunki obyekt topshirilmagani haqidagi gap hech qanday dalil bilan tasdiqlanmagan.»

**Hozir:** sudya «savolga aniq javob bering…» deydi, feedback `info`: «aniqlashtirish so'raldi».

**Kutilgan natija:** «Sud e'tirozni qabul qildi» yoki «E'tiroz rad etildi…».

Asossiz «Hurmatli sud, eʼtiroz bildiraman.» ham xuddi shunday tanilmayapti.

### P1-3. Erta bosqichlarda o'rinsiz harakat "to'g'ri" deb baholanib, bosqich o'tib ketyapti

| Bosqich | Talaba | Hozir | Kerak |
|---|---|---|---|
| Rad qilish | raqibga savol | sudya to'g'ri aytadi: «savollar keyin beriladi». Lekin feedback `good` «To'g'ri: … IPK 20» va bosqich o'tib ketadi | bosqich o'zgarmasin, feedback `info` yoki `bad` |
| Huquqlarni tushuntirish | guvoh iltimosnomasi | `good` «IPK 20», bosqich o'tadi | xuddi shunday |
| «Iltimosnomalaringiz bormi?» | keyinga qoldirishni so'rash | `good` «huquqlar tushunarli (IPK 165)» | iltimosnoma sifatida ko'rilsin (IPK 171) |

Hozirgi holatda talaba nima desa ham "to'g'ri" deb baholanadi va hisobot buziladi.

### P1-4. Feedback sudya gapiga zid

Vakolat bosqichida «Hurmatli sud, javobgar qarzdor.» desa:
- sudya ishonchnomani qayta so'raydi;
- lekin feedback «Qabul qilindi.» deydi.

Feedback ham «aniqlashtirish so'raldi» bo'lishi kerak.

### P1-5. `beginner` darajada variant tanlanganda javob 6–11 s keladi

`sud-ijara-javobgar` rolida tayyor variant tanlanganda ba'zi navbatlar 11,2 s, 6,2 s va 6,0 s oldi. Bu raqib javobi va dalillar bosqichi. Hujjatda variant va gibrid javob uchun ≤ 2 s deyilgan.

`/health` da `llm.provider: "aihub"` (gemini, chatgpt) ko'rinyapti. Ehtimol, `beginner` darajada ham LLM yoki tashqi chaqiruv bo'lyapti.

**Kerak:** `beginner` va `intermediate` darajada LLM chaqirilmasin, javob ≤ 2 s bo'lsin.

### P1-6. Sudya bir xil gapni so'zma-so'z takrorlaydi

- Har bir harakatdan keyin sudya bir xil gapni qaytaradi: «Daʼvogar vakili, javobgar obyekt dalolatnoma bilan topshirilmaganini aytmoqda. Bunga munosabatingiz?» Bir sessiyada 5 marta chiqdi.
- «Javobgar vakili, nutqingizni yakunlang…» ketma-ket 2 marta chiqdi.

Bu robotdek eshitiladi.

**Kerak:** qaytish uchun 2–3 ta qisqa variant, masalan «…savolga qaytamiz: …», «Endi asosiy savolga javob bering: …». Variantlarning hammasini prerender qiling.

---

## P2 — barqarorlik

- **Bir martalik 502.** Bir marta `POST /sessions` muvaffaqiyatli o'tdi, keyin shu sessiyaga keyingi so'rovlar 502 qaytardi. Xabar bo'sh edi, ehtimol nginx'dan. Bir daqiqadan keyin hammasi tiklandi. Xizmat qayta ishga tushganda sessiyalar saqlanib qolishini tekshiring.
- **`/health` ga ovoz holatini qo'shing:**
  - `stt` va `tts` qaysi dvigatelda ishlayapti;
  - GPU ulanganmi;
  - keshda nechta gap bor.

  Shunda muammoni sinovsiz, birinchi qarashda ko'ramiz.
- **STT `confidence`** hali `null`. Biz `stt` maydonini yubormayapmiz, kelganda ishlatamiz.

---

## Frontend tomonda qilingan ishlar (ma'lumot uchun)

- Yangi domen ulandi.
- Azure olib tashlandi: ovoz faqat sizdan keladi, server ishlamasa brauzer ovozi zaxira.
- `voice` rolga qarab yuboriladi: `judge` → `elder_m`, `secretary` → `female`, `opponent` → `female_alt`, `witness`/`expert` → `male`; `system` ovozlashtirilmaydi.
- Matn o'zgarishsiz yuboriladi, faqat boshidagi sahna izohi (`(sekin)`) olib tashlanadi. Prerender ro'yxati ham aynan shu qoida bilan tuzilgan.
- Sud zalida «Raqibga savol», «Iltimosnoma», «Eʼtiroz», «Kelishuv» chiplari qo'shildi.
- Sud zalida keyingi gaplarning ovozi oldindan yuklanadi (spikerlar orasida pauza yo'q).
- Hub'da «Tasodifiy ish» tugmasi qo'shildi (oxirgi 3 ta ish takrorlanmaydi), ssenariylar `GET /scenarios` dan dinamik chiqadi.
- Hisobot sarlavhasi to'g'rilandi: endi haqiqiy ssenariy nomini ko'rsatadi (avval hamma joyda «DXM» chiqardi).
- Sizning `lexsim_owner` cookie'ingiz endi bizning httpOnly cookie'da ham saqlanadi. Netlify serverless'da instance almashsa, talabaning sud sessiyasi uzilmaydi.
- Yangi QA skriptlari: `tools/qa/live.mjs`, `tools/qa/voice-coverage.mjs`.

## Qabul (hammasi bajarilgach)

```bash
curl -s https://lex-api.e-investment.uz/api/v1/voice/status   # tts va stt null emas
node tools/qa/voice-coverage.mjs                              # FAIL 0, hamma gap hit
node tools/qa/live.mjs                                        # 8/8
node tools/qa/economic.mjs                                    # hisobotgacha, konsolda xato yo'q
```

**Ilova:** yangilangan `lines.json` (97 gap).
