# LexSim — backend uchun vazifalar v15

**Kimga:** backend dasturchisi.
**Sana:** 2026-11-21.
**Server:** `https://lex-api.e-investment.uz/api/v1` (1.4.1).

Bu hujjat [LexSim_Backend_Vazifalar_v14.md](LexSim_Backend_Vazifalar_v14.md) ning davomi. v14 dagi "Asosiy yangi vazifa" (10 ssenariy, improvizatsiya, ovoz qatlamlari, `scene`) kuchda qoladi. Bu yerda faqat yangi va o'zgargan narsalar.

**Maqsad:** 10 ta ish, har biri o'z aktyorlari, ovozlari, ohangi va hujjatlari bilan. Ish yuridik jihatdan to'g'ri bo'lishi kerak, talaba esa butun majlisini qayta ko'rib, tinglab, yuklab ola olsin.

---

## 0. v1.4.1 ni tekshirdik

| Narsa | Natija |
|---|---|
| Jonli sud (`tools/qa/live.mjs`) | ✅ 8/8: e'tiroz endi qaror bilan |
| Erta bosqichdagi o'rinsiz harakat, vakolat feedback'i | ✅ |
| Sud zali ovozlari | ✅ 43/43 tayyor (`hit`) |
| "Ish yo'li" ovozlari | ✅ 95/97 (2 tasi qolgan, 1-band) |
| Keshda yo'q gap | ✅ 200, ~4 s |
| CORS | ✅ |
| STT | ⚠️ ishlaydi, lekin CPU'da va sekin (1-band) |
| `/voice/status` | ❌ `stt: null` qaytaradi, holbuki STT ishlaydi (1-band) |
| `npcTurn.emotion` | ❌ hamma gapda `neutral`. Yuz va ohang o'zgarmaydi (3-band) |

---

## 1. Ovoz — tuzatish

1. **`/voice/status` → `stt: null`, lekin `POST /voice/stt` ishlaydi.** Biz vaqtincha `sttEngine` maydoniga qarab ishlatyapmiz. Status haqiqiy holatni bersin: `"stt": "gpu"` yoki `"cpu"`.
2. **STT GPU'da emas.**
   - `/health` da `gpu.stt: true` turibdi, lekin javobda `engine: "kotib"`. 2,6 s audio 15,9 s da tanildi.
   - Kerak: GPU ulanganda so'rov GPU'ga ketsin, 5 s audio ≤ 2,5 s.
3. **TTS tezlik cheklovi (429).**
   - Biz keyingi 3 ta gapni oldindan so'raymiz: shunda spikerlar orasida pauza bo'lmaydi.
   - "Amaliyot yozuvi"da butun majlis ovozi bitta faylga yig'iladi, bu 40–80 ta gap degani.
   - Bitta talaba bilan sinaganimizda 140 ta so'rovdan 19 tasi `429` oldi.
   - Kerak:
     - keshdan qaytgan gap (`X-TTS-Cache: hit`) limitga **sanalmasin**;
     - yangi render uchun limit talaba boshiga ≥ 60/daq bo'lsin;
     - `Retry-After` doim yuborilsin. Biz uni kutamiz.
4. **"Ish yo'li"da qolgan 2 ta gap** (`female`):
   - «Shart. Javobgar oʻz nusxasini oladi.»
   - «Mayli, imzolayman.»
5. **Chatterbox o'chiq** (`gpu.chatterbox: false`). Yangi gaplar boshqa (MMS) ovozda chiqadi. GPU qaytgach, `auto-prerender` ularni klon ovozda qayta yozsin.

**Qabul mezoni:** `node tools/qa/voice-coverage.mjs` natijasi `court FAIL 0`, `case FAIL 0`, `rate-limited waits 0`.

---

## 2. Har bir ish o'zgacha eshitilsin: ovozlar palitrasi

Hozir 4 ta ovoz bor, hamma ishda bir xil. 10 ta ishda bir xil sudya va bir xil raqib ovozi sun'iy eshitiladi.

### 2.1. Palitra (kamida)

| Rol turi | Ovozlar | Izoh |
|---|---|---|
| Sudya | 3 ta: 2 erkak (keksa, o'rta yosh), 1 ayol | Ish turiga qarab almashadi |
| Kotib | 2 ta ayol | |
| Advokat yoki vakil | 2 erkak + 2 ayol | Raqib har ishda boshqacha |
| Taraf (mijoz, direktor, tadbirkor) | 2 erkak + 1 ayol | |
| Guvoh yoki ekspert | 1 erkak + 1 ayol | |

**Talablar:**
- Har bir ovoz uchun egasining yozma roziligi bo'lsin (hozirgi tartib).
- Nomlar: `[a-z][a-z0-9_]{1,23}`, masalan `judge_m2`, `lawyer_f1`. Bunday nomlarni bizning `POST /voice/tts` allaqachon qabul qiladi.

### 2.2. Ovoz tanadagi jinsga mos bo'lsin (majburiy)

**Frontend endi ovozni aktyor tanasiga qarab tanlaydi.** Ayol modellari: `woman`, `secretary`, `lawyer`, `clerk`. Masalan:
- raqib `lawyer` bo'lsa, `female_alt`;
- raqib `man` bo'lsa, `male`;
- guvoh `clerk` bo'lsa, `female`.

`scene.voices` bersangiz, u ustun bo'ladi. Lekin **jins mos kelishi shart**: ayol aktyorga erkak ovozi berilmasin.

```json
"scene": {
  "cast":   { "principal": "client", "opponent": "man", "witness": "clerk" },
  "voices": { "judge": "judge_m2", "secretary": "secretary_f1", "opponent": "lawyer_m1", "witness": "witness_f1" }
}
```

**Prerender:** ssenariyning har bir gapi aynan shu ssenariydagi rol ovozi bilan yozilsin (kalit: `voice + matn`). Ovozlar xaritasi o'zgarsa, `auto-prerender` qayta ishga tushsin.

### 2.3. Ohang (emotsiya) ovozda ham

Biz har bir TTS so'roviga `emotion` maydonini qo'shib yuboramiz. Bu `npcTurn.emotion` ning o'zi: `neutral`, `impatient`, `upset`, `confused`, `uncertain`, `calm`, `reassured`.

- Chatterbox'da buni ohang parametri sifatida ishlating (exaggeration, cfg).
- **Kesh qoidasi:** emotsiya varianti oldindan yozilgan bo'lsa, shu ishlatilsin. Yozilmagan bo'lsa, **neytral keshdagisi** qaytsin, yangi render qilinmasin. Emotsiya hech qachon kutishga sabab bo'lmasin.

---

## 3. Mimika va imo-ishora: `emotion` va `gesture`

Hozir hamma gapda `emotion: "neutral"`, shuning uchun yuzlar bir xil qoladi. Frontend yuz, qosh va qad-qomatni `emotion` dan, harakatni esa `gesture` dan oladi.

**Har bir `npcTurn` ga ma'noga mos emotsiya qo'ying:**

| Vaziyat | `emotion` | `gesture` (ixtiyoriy, yangi maydon) |
|---|---|---|
| Sudya majlisni ochadi, tushuntiradi | `calm` | — |
| Sudya ogohlantiradi («Hurmatli sud deb murojaat qiling», «tik turing») | `impatient` | `shake-head` |
| Sudya aniqlashtirishni so'raydi | `uncertain` | `lean-in` |
| Sudya e'tirozni yoki iltimosnomani qanoatlantiradi | `calm` | `nod` |
| Sudya rad etadi | `neutral` | `shake-head` |
| Raqib ishonch bilan e'tiroz bildiradi | `calm` | `lean-in` |
| Raqib noqulay faktni tan oladi | `uncertain` | `sigh` |
| Raqib talabaning savoliga e'tiroz bildiradi | `upset` | `shake-head` |
| Kotib e'lon qiladi | `neutral` | — |
| Taraf (mijoz) xavotirda | `uncertain` | — |

`gesture` qiymatlari: `none`, `nod`, `shake-head`, `sigh`, `lean-in`, `check-watch`, `stand`. Biz endi `npcTurn.gesture` ni qabul qilamiz va o'yinchida ijro etamiz. Noma'lum qiymat bo'lsa, e'tiborga olinmaydi.

**Qoida:** ovoz ohangi (2.3), yuz (`emotion`) va harakat (`gesture`) bir gapda **bir-biriga mos** bo'lsin. Jahl bilan aytilgan gapga tabassum qo'yilmasin.

---

## 4. 10 ssenariy: yuridik va mantiqiy to'g'rilik (majburiy tekshiruv)

Ssenariy xato bo'lsa, talabani noto'g'ri o'rgatadi. Har bir ssenariy ishga tushishidan oldin quyidagi tekshiruvdan o'tsin: avval `validate_scenario` linteri, keyin mentorning imzosi.

### 4.1. Sudlovlik

- Iqtisodiy sudda **faqat** tadbirkorlik subyektlari orasidagi iqtisodiy nizolar ko'rilsin (MChJ, AJ, YaTT va hokazo).
- **Davlat organi qarori ustidan nizo** (soliq, hokimiyat) — ma'muriy sud ishi. Iqtisodiy sud ssenariysi sifatida berilmasin.
  - Biz v14 dagi 10-mavzuni (ma'muriy hujjat) shu sababli olib tashladik va **«Yuk tashish: yo'qolgan yoki shikastlangan yuk»** bilan almashtirdik.
  - Frontendda ham shunday: sahna presetlari yangilandi.
- Fuqaro va fuqaro orasidagi nizo fuqarolik sudi ishi. U alohida rejim bo'lsin ("Ish yo'li", FPK), iqtisodiy sud ichiga aralashmasin.

### 4.2. Faktlar bir-biriga zid bo'lmasin (linter tekshiradi)

- **Sanalar mantiqiy:** shartnoma < bajarish muddati < buzilish < talabnoma < da'vo < majlis.
- **Summalar arifmetik to'g'ri:**
  - asosiy qarz + penya = da'vo summasi;
  - penya stavkasi × kunlar × summa = penya;
  - cheklov bo'lsa, unga rioya qilingan.
  - Linter qayta hisoblab tekshiradi.
- **Bir xil fakt hamma joyda bir xil:** brifing, `facts`, `scene.papers` (hujjat matni), sudya gaplari va raqib banki.
  - Masalan, shartnoma № 32-P va «2022-yil 1-aprel» hamma joyda bir xil.
- **Taraflarning huquqiy shakli to'g'ri:** «MChJ direktori», «YaTT» va hokazo. Vakolat hujjati ham shunga mos bo'lsin: yuridik shaxs vakiliga ishonchnoma.
- **Da'vo muddati (davomiyligi)** buzilmagan yoki ataylab buzilgan bo'lsin. Ataylab bo'lsa, bu ssenariyning o'quv nuqtasi va `keyMoments` da qayd etilgan bo'lishi kerak.
- **Talabnoma (pretenziya) bosqichi:** qonun yoki shartnoma talab qilsa, uning hujjati `evidence[]` da bor bo'lsin.

### 4.3. Moddalar

- Faqat normalar bazasidan (`articleId`) olinadi.
- Har biriga mentor `verifiedAt` qo'yadi.
- Hujjat matnida (`scene.papers`) modda yozilmaydi: hujjat fakt, huquqiy baho talabaning ishi.
- **«Manba bo'lmasa, modda yo'q»** — bu qoida o'zgarmaydi.

### 4.4. Har bir ish o'zgacha bo'lsin

Har bir ishda quyidagilar farq qiladi:
- taraflar (nomlari, faoliyat turi);
- sudya: ovozi, xarakteri (qat'iy yoki muloyim), tezligi;
- raqibning taktikasi (`persona.strategy`): biri summaga, biri dalolatnomaga, biri muddatga yopishadi;
- stoldagi hujjatlar va guvoh yoki ekspert bor-yo'qligi;
- murakkablik (`difficulty`) va ishning o'quv nuqtalari (`keyMoments`). Takrorlanmasin.

### 4.5. Tekshiruv varaqasi (har ssenariyga, mentor imzolaydi)

```
[ ] Sudlovlik to'g'ri (iqtisodiy sud: tadbirkorlar orasida iqtisodiy nizo)
[ ] Taraflar va ularning huquqiy shakli, vakolat hujjati to'g'ri
[ ] Sanalar ketma-ketligi mantiqiy
[ ] Summalar qayta hisoblandi va mos keladi
[ ] Bir fakt hamma joyda bir xil (brifing, hujjat, gaplar)
[ ] Har bir modda bazada, mentor tasdig'i bor (verifiedAt)
[ ] Ideal yo'l va qaror funksiyasi (outcome) qonunga mos
[ ] Maxfiy faktlar faqat o'z tomonida
[ ] Ovozlar xaritasi jinsga mos, barcha gaplar prerender qilingan
[ ] Oltin transkriptlar (beginner, advanced yaxshi, advanced yomon) o'tdi
Mentor: ______________   Sana: ________
```

---

## 5. Amaliyot yozuvi (frontendda tayyor), sizdan: o'qituvchiga yetkazish

**Frontendda qilindi:**
- **Majlis yozuvi.** Hisobot sahifasida va har bir xona natijasida kim nima degani ketma-ket ko'rsatiladi. Talabaning har bir javobi «ovozli» yoki «yozma» deb belgilanadi.
- **Talabaning ovozi** faqat uning brauzerida saqlanadi (IndexedDB) va hech qayerga yuborilmaydi.
- **«Butun majlisni tinglash».** Sud ovozlari va talabaning o'z ovozi bitta yozuvga yig'iladi. Matn ovoz bilan birga yuradi, istalgan gapni bosib o'sha joyga o'tish mumkin.
- **Yuklab olish:**
  - **PDF** — A4 hujjat: natija, mezonlar, to'liq yozuv, har bir qaror tahlili;
  - **Word**;
  - **Audio (WAV)**;
  - o'qituvchilar uchun **LMS (xAPI)**.
  - Avval xona natijasida faqat «Hisobot (JSON)» bor edi, u olib tashlandi.

**Sizdan (keyingi bosqich, talabaning roziligi bilan):**
- `POST /records`: talaba yozuvini o'qituvchiga yuborish.
  - Tarkibi: transkript, ball, mezonlar, ixtiyoriy audio (WAV, ≤ 20 MB).
  - Faqat talaba «O'qituvchiga yuborish»ni bosganda yuboriladi.
- `GET /teacher/records`: `/teacher` panelida guruh bo'yicha ro'yxat, tinglash va izoh qoldirish.
- **Saqlash:** muddati (masalan, 180 kun) va o'chirish so'rovi. Audio shaxsiy ma'lumot, shifrlangan holda saqlansin.

Biz `POST /records` uchun UI'ni (rozilik va yuborish tugmasi) endpoint tayyor bo'lishi bilan qo'shamiz.

---

## 6. Frontendda bu bosqichda qilinganlar (ma'lumot uchun)

- **Ovoz va aktyor mosligi.** Ovoz endi aktyor tanasiga va ssenariyga qarab tanlanadi; `scene.voices` qo'llab-quvvatlanadi.
- **Emotsiya va imo-ishora.** `emotion` TTS so'roviga qo'shib yuboriladi, `npcTurn.gesture` qabul qilinadi va ijro etiladi.
- **Vaqt:**
  - gaplar hech qachon ustma-ust tushmaydi;
  - bir spiker ketma-ket gapirsa, gaplar orasida ~0,25 s pauza bo'ladi; spiker almashsa, ~0,55 s;
  - sudya yoki guvoh joyiga yetib kelgandan keyin gapira boshlaydi, yurib kelayotganda gapirmaydi;
  - keyingi 3 ta gap oldindan yuklanadi.
- **429 bo'lsa,** server tomonidagi so'rov bir marta qisqa kutib qayta yuboriladi.
- **Sahna presetlari:** «Ma'muriy nizo» olib tashlandi, «Yuk tashish» qo'shildi. Qarz va lizing ishlarida raqib endi erkak, ovozi ham erkak.
- **Hisobot:** sarlavha va takrorlanuvchi matnlar tuzatildi. PDF va Word hujjat dizayni yangilandi.
- **Zal munosabatlari:** turmagan talabaga hamma qaraydi, o'tirib gapirilsa eslatma kuchayadi, jimlikda sudya kutadi. `npcTurn.reactions` qabul qilinadi (7-band).
- **Testlar:** 44/44 yashil. `contracts.schema.json` yangilandi: `scene.voices`, `turn.gesture`, `turn.reactions`.

---

## 7. Zal "tirik" bo'lsin: har bir element munosabat bildiradi

Sud zalida hech kim manekendek turmasligi kerak. Talabaning har bir harakatiga (yoki harakat qilmasligiga) zal javob beradi. Ish ikkiga bo'linadi:
- **frontend** darhol ko'rinadigan, so'zsiz munosabatni beradi: nigohlar, yuz, eslatma (qilindi);
- **backend** og'zaki munosabat, uning bosqichma-bosqich kuchayishi va baholash bilan shug'ullanadi (siz qilasiz).

### 7.1. Frontendda qilindi

| Vaziyat | Zal nima qiladi |
|---|---|
| Sud kirdi, hamma turdi, talaba o'tirib qoldi | 1,5 s dan keyin **hamma talabaga qaraydi**: sudya `impatient`, kotib `uncertain`, raqib `confused`. Ekranda «Hamma oʻrnidan turdi — siz ham turing» va «G Turish» tugmasi chiqadi. Talaba tursa, nigohlar yana sudyaga qaytadi |
| Talaba o'tirgan holda sudga gapirdi | Zal unga qaraydi, eslatma har safar kuchayadi: 1 — «Sudga tik turib murojaat qilinadi»; 2 — «Yana oʻtirgan holda gapirdingiz — hamma sizga qaradi»; 3+ — «Sudya norozi…» (qizil) |
| Sud javob kutyapti, talaba jim | ~7 s dan keyin sudya talabaga qarab kutadi (`impatient`). Undan keyin sizning `silence` hodisangiz ishlaydi |
| Kimdir gapiryapti | Hamma unga qaraydi. Talaba gapirsa, hamma talabaga qaraydi |
| Sudya yoki guvoh kiryapti | Joyiga yetib kelgandan keyin gapira boshlaydi |
| Gap bilan imo-ishora | `npcTurn.gesture` ijro etiladi (3-band) |
| Tinglovchilarning munosabati | **Yangi:** `npcTurn.reactions` (7.3) |

### 7.2. Sizdan: og'zaki tanbeh va uning kuchayishi

**Qoida:** bir xil xato takrorlansa, sudya **qattiqroq** gapiradi. Har safar bir xil gap aytilmaydi. Hisoblagich sessiya davomida saqlanadi. Bosqichlar `beginner` darajada yumshoqroq, `advanced` da qattiqroq.

**O'tirgan holda sudga murojaat** (sizda `standing=false` bo'lganda `turn`):

| Necha marta | Sudya (`judge`) | `emotion` / `gesture` | Baho |
|---|---|---|---|
| 1 | «Vakil, sudga oʻrningizdan turib murojaat qiling.» | `calm` / — | beginner: eslatma, ball yo'q |
| 2 | «Sizga ikkinchi marta eslatyapman: sudga tik turib murojaat qilinadi.» | `impatient` / `shake-head` | −2 (Sud odobi) |
| 3 | «Sud majlisi tartibiga rioya qilmayapsiz. Ogohlantirish bayonnomaga kiritiladi.» | `upset` / `shake-head` | −5, `decisions[]` da `bad` |
| 4+ (`advanced`) | Sud tartib buzilishi bo'yicha choralarni qo'llashi mumkinligini aytadi | `upset` | Etika mezoni pasayadi |

**Shu zinapoya bo'yicha qo'llanadigan boshqa xatolar** (har biri o'z hisoblagichi bilan):
- «Hurmatli sud» demasdan gapirish;
- sud kirganda turmaslik (`start` dan keyin `stand` kelmasa, kotib yoki sudya eslatadi);
- sudya gapini bo'lish;
- raqibga sud orqali emas, to'g'ridan-to'g'ri murojaat qilish;
- mavzudan chetga chiqish;
- jimlik;
- ovozni ko'tarish yoki haqorat. Haqorat avvalgidek darhol etika bo'yicha baholanadi.

**Talablar:**
- Tartib buzilishi uchun choralarni (ogohlantirish, zaldan chiqarish va boshqalar) faqat normalar bazasidagi moddaga bog'lang (`articleId` va mentor tasdig'i bilan). Modda bo'lmasa, sudya moddasiz gapiradi. Biz moddani o'zimiz to'qimaymiz.
- Barcha tanbeh gaplari 2–3 variantda bo'lsin va prerender qilinsin (A qatlam, v14 5.2).

### 7.3. Sizdan: tinglovchilar munosabati (`reactions`) — yangi maydon

Gapni bitta odam aytadi, lekin uni hamma eshitadi. Endi har bir `npcTurn` da qolganlarning munosabatini yuborishingiz mumkin. Frontend ularning yuzini shunga moslaydi:

```json
{ "speaker": "npc", "role": "judge", "text": "…iltimosnoma rad etilsin.", "emotion": "neutral", "gesture": "shake-head",
  "reactions": [ { "role": "opponent", "emotion": "reassured" }, { "role": "principal", "emotion": "upset" } ] }
```

- `role`: `judge`, `secretary`, `opponent`, `witness`, `expert`, `principal` (talabaning yonidagi mijoz).
- `emotion`: 3-banddagi ro'yxatdan.
- Har gapga ≤ 5 ta munosabat. Noto'g'ri qiymat e'tiborga olinmaydi va sessiya buzilmaydi.

**Qayerda ishlatish kerak:**

| Gap | Munosabat |
|---|---|
| Sud talabaning iltimosnomasini rad etdi | raqib `reassured`, mijoz `upset` |
| Sud talabaning e'tirozini qabul qildi | raqib `upset`, mijoz `reassured` |
| Raqib noqulay faktni tan oldi | mijoz `reassured`, sudya `calm` |
| Talaba kuchli dalil keltirdi (backend shunday baholasa) | raqib `uncertain`; keyingi gapda raqib `lean-in` bilan javob beradi |
| Sudya talabani tanbehladi | mijoz `uncertain`, kotib `neutral` |
| Guvoh chalkashdi | sudya `uncertain`, raqib `confused` |

### 7.4. Sizdan: zalning kichik, lekin muhim lahzalari

1. **Sud maslahatxonaga ketishi va qaytishi.** Hamma turadi (`scene.everyoneStands: true`). Qarorni o'qish ham tik turib tinglanadi, keyin «Oʻtiring».
2. **Guvoh.**
   - Sudya guvohga javobgarlikni tushuntiradi va guvoh tilxat beradi. Bu protsessual tartib, moddasini mentor bazadan qo'yadi.
   - Guvoh `uncertain` holatda gapiradi, raqib so'roq qilganda `confused` ga o'tishi mumkin.
3. **Tik turish.** Taraf faqat sudga murojaat qilganda tik turadi. Raqib gapirayotganda talaba tik tursa, sudya «Oʻtirishingiz mumkin» deydi. Bu yengil eslatma, ballsiz.
4. **Kotib.** Har bir rasmiy qarordan keyin qisqa «Bayonnomaga kiritildi» deydi. Doim emas, faqat muhim joylarda.
5. **Vaqt.** Juda uzun monologda (> 90 s yoki > 120 so'z) sudya muloyim to'xtatadi: «Qisqaroq, mohiyatini ayting.»
6. **Raqibning gap bo'lishi** (`advanced`): ba'zan talabaning gapidan keyin raqib «E'tiroz, hurmatli sud!» deydi. Sudya: «Navbatingiz kelganda.» Shunda talaba sud tartibini ko'radi.

### 7.5. Frontend backlog (biz qilamiz, sizdan hech narsa kerak emas)

- Kotib tinglash paytida yozib o'tiradi (qo'l animatsiyasi).
- Raqib va mijoz bir-biriga pichirlaydi: kuchli dalildan keyin `lean-in`.
- Zalda yengil fon tovushi (qog'oz, stul). Bu "Ovoz" sozlamasiga bog'lanadi, reduced-motion va jim rejimda o'chadi.


## 8. Qabul

```bash
curl -s https://lex-api.e-investment.uz/api/v1/voice/status    # tts va stt null emas
node tools/qa/voice-coverage.mjs                               # FAIL 0, rate-limited waits 0
node tools/qa/live.mjs                                         # 8/8
# har ssenariy: emotion ≠ hammasi neutral; ovoz jinsi aktyorga mos; 4.5-varaqa imzolangan
# zal: 3 marta o'tirib gapirilsa, sudya tanbehi 3 xil va kuchayib boradi; rad yoki qabul qarorlarida reactions bor (7.2–7.3)
```

**Ilova:** yangilangan `contracts.schema.json`.
