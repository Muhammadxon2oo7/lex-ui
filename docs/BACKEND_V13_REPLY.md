# LexSim — Frontend javobi: backend v1.3 (+ D6 gibrid) qabul qilindi

**Kimga:** LexSim court backend jamoasi (AI dasturchi va uning agenti)
**Kimdan:** LexSim frontend (`lexsim-web`, Next.js 16)
**Sana:** 2026-11-21
**Asos:** sizning `LexSim_Backend_AI_javob.md` (v1.3, D6 gibrid qo'shimchasi bilan). Oldingi hujjatlar:
- `LexSim_Frontend_v2_Backend_Moslash.md`;
- `LexSim_Backend_AI_Toliq_Topshiriq.md`.

---

## 0. Qisqacha

| | Holat |
|---|---|
| Darajalar (beginner / intermediate / advanced) | ✅ Frontendga ulandi, jonli tekshirildi |
| `reveal-options`, `silence`, `inputMode`, `stt`, `hint` | ✅ Ulandi |
| **D6 gibrid (tayyor javoblar banki + LLM)** | ✅ **Jonli o'lchandi: har bir javob 0,04–2,1 s.** Oldin 60–110 s edi. Katta ish, rahmat |
| Kalitli API (`/nlu/match`, `/store/cases`, `/xapi/statements`, `/voice/*`, `/voice/prerender`) | 🟡 Kod tayyor. Kalit Next serverining `.env.local` fayliga qo'yilgach jonli tekshiriladi |
| Siz so'ragan `contracts.schema.json` | ✅ Ilova qilindi |
| Siz so'ragan ovoz ro'yxati | ✅ Ilova qilindi: 97 ta gap va render skripti |
| Ochiq muammolar | §4 da, ustuvorlik bo'yicha |

---

## 1. Biz tekshirgan narsalar (2026-11-21, cookie sessiya, `sud-ijara-davogar`)

| Tekshiruv | Natija |
|---|---|
| `level:"beginner"` | Har bosqichda 4 ta variant, tartib aralashtirilgan. Javobdan keyin `feedback` + modda (masalan, `IPK 62-modda`) ✅ |
| Beginner'da xato variant | Sudya savolni qayta beradi, variantlar qayta chiqadi ✅ |
| `level:"intermediate"` | Variantlar yashirin; `reveal-options` → ochiladi ✅. `feedback` faqat jiddiy xatoda ✅ |
| `level:"advanced"` | `optionId` → **422** ✅; `/hint` → **409** ✅ |
| Protsessual bosqich (ochilish, rad qilish, iltimosnomalar) | Har bir javob **36–134 ms** ✅ |
| Mazmunan ko'rish (`engine:"scripted"`) | Har bir javob **1,1–2,1 s** ✅. Raqib talaba dalili bo'yicha gapiradi (FK 326, penya) |
| Talaba dalolatnoma bor deb aytganda (F3 bo'yicha dalolatnoma yo'q) | `feedback.tone:"bad"` to'g'ri. Lekin matn aniq emas (§4, B5) |
| `GET /health` | ⚠️ hali ham `version: "1.2.0"` (§4, B1) |

Frontend QA (Playwright) to'liq o'tdi:
- `economic.mjs`;
- `levels.mjs`;
- `case.mjs`;
- `theft.mjs`;
- `dismiss.mjs`.

**Frontendga ta'siri:** gibrid javoblar tez bo'lgani uchun "LLM kutilmoqda" chipi endi faqat `advanced` darajada, LLM'ga tushgan holatda ko'rinadi. Frontend sinxron `200` ni ham, async `202 + /events` ni ham bir xil qo'llaydi, shuning uchun o'zgartirish shart emas.

---

## 2. Frontend sizning API'ni qanday ishlatadi (aniq shartnoma)

> Muhim: brauzer hech qachon serveringizga to'g'ridan-to'g'ri murojaat qilmaydi. Barcha chaqiruvlar Next.js serveri orqali o'tadi. Kalit faqat serverda turadi.

### 2.1. Ikki xil autentifikatsiya

1. **Sessiya (cookie):** `/sessions/**`, `/scenarios`, `/health`. Har bir talaba (owner) uchun alohida cookie jar saqlanadi.
2. **Kalitli (server-server):** quyidagi ikki header bilan:
   ```
   X-LexSim-Key:   <LEXSIM_REMOTE_KEY>
   X-LexSim-Owner: <studentHash>   // sha256("lexsim:v1:" + ownerToken).hex.slice(0,32)
   ```
   `studentHash` qaytarib bo'lmaydigan, barqaror identifikator. Ism, email va cookie **hech qachon** yuborilmaydi.

### 2.2. Ishlatiladigan endpointlar va timeoutlar

| Endpoint | Qayerda | Timeout | Izoh |
|---|---|---|---|
| `GET /health`, `GET /scenarios` | Hub kartasi | 4 s | Server o'lik bo'lsa, karta yashirinadi |
| `POST /sessions` | Iqtisodiy sud | qisqa | `level` yuboriladi |
| `POST /sessions/{id}/turns` | | 180 s | `{clientTurnId (uuid), optionId? \| text?, inputMode, stt?}`; 200 ham, 202 ham qo'llanadi |
| `GET /sessions/{id}/events?after=n` | | qisqa | Polling |
| `POST /sessions/{id}/interactions` | | qisqa | `start`, `sit-at-desk`, `stand`, `sit`, `reveal-options`, `silence` |
| `POST /sessions/{id}/documents`, `/finish` | | qisqa / 65 s | |
| `GET /sessions/{id}/report`, `POST …/appeal` | Hisobot | qisqa | |
| `GET /sessions/{id}/hint[?preview=1]` | | qisqa | `preview` — ballsiz ko'rish |
| `POST /nlu/match` 🔑 | "Ish yo'li" | **4 s** | §2.3 |
| `GET/PUT /store/cases/{id}` 🔑 | "Ish yo'li" | 8 s | §2.4 |
| `POST /xapi/statements` 🔑 | "Ish yo'li" | 8 s | §2.5 |
| `GET /voice/status` | Barcha xonalar | 3 s | |
| `POST /voice/tts` 🔑/cookie | | 20 s | `{text, voice}`, `voice` ∈ `elder_m \| male \| female \| female_alt` |
| `POST /voice/stt` 🔑/cookie | | 40 s | `audio/wav` 16 kHz mono |
| `POST /voice/prerender` 🔑 | Skript | — | §3.2 |

🔑 — kalitli chaqiruv.

**Degradatsiya qoidasi:** kalitli chaqiruvlarning har qandayi xato bersa yoki timeout bo'lsa, frontend o'zining lokal mantig'i bilan davom etadi. Talaba hech qachon xato ekranini ko'rmaydi. Shuning uchun **tez va aniq status kodlari** biz uchun muhim.

### 2.3. `/nlu/match` — "Ish yo'li" ishlarida o'z so'zi bilan javob

So'rovimiz §4.1 kontraktingizga mos:
```json
{
  "utterance": "Hurmatli sud, da'vogar 9–10-oktabr kunlari kasal bo'lgan…",
  "inputMode": "voice",
  "stt": { "confidence": 0.82 },
  "context": { "case": "labour", "stage": "hearing", "node": "h-open", "prompt": "Sudya: Da'vo talabingizni bayon qiling." },
  "candidates": [ { "id": "claim", "text": "…", "tone": "good" }, { "id": "env", "text": "…", "tone": "bad" } ],
  "rubric": { "mustAddress": true, "forbidden": ["pora", "tanish", "konvert", "pul beraman", "kelishib qo'yamiz"] }
}
```

Biz javobdan quyidagi maydonlarni o'qiymiz:
- `match.id` → shu variant talabaning so'zlari bilan qabul qilinadi.
- `match = null` → `clarify` talabaga ko'rsatiladi, ball ayirilmaydi.
- `quality.ethics = "violation"` → xonadagi tuzoq variant tanlanadi yoki jarima beriladi.

Qabul qilamiz:
- reranker ostonalari (`match ≥ 0.6`, `clarify ≥ 0.25`);
- "yaqin `good`/`bad` → `clarify`" xavfsizlik qoidasi;
- `low_stt` xatti-harakati.

Keyingi qadamda (mentor har bir lahza uchun kerakli faktlarni belgilagach) quyidagilar ham yuboriladi:
- `rubric.facts` (`{id: "ma'no matni"}`);
- har bir nomzodga `examples`.

`quality.factsMissing` ni debrief'da "nimani aytmadingiz" sifatida ko'rsatamiz.

**STT ishonchi:** server STT (kotib) `confidence` bermagani uchun bu holatda biz `stt` maydonini **yubormaymiz**. Maydon faqat brauzer yoki Azure bahosi bo'lsa yuboriladi. B4 ga qarang.

### 2.4. `/store/cases` — ishni saqlash (optimistik versiya)

```
PUT /store/cases/{caseId}
{ "owner": "<studentHash>", "kind": "labour"|"theft"|"index", "state": {…}, "version": <oxirgi ko'rgan versiya, yangi uchun 0> }
→ 200 { "id", "version": n+1 }   |   409 version_conflict { "version": <joriy> }   |   403
```
- 409 kelsa, biz joriy versiyani olib bir marta qayta yozamiz. Xotiradagi engine haqiqat manbai hisoblanadi.
- Har bir talaba va ish turi uchun alohida indeks hujjat yuritiladi: `idx-<hash24>-<kind>` → `{ caseId }`. Server qayta ishga tushsa, ish shu indeks orqali tiklanadi.
- `state` — bizning ichki JSON'imiz. Uni o'qimang va o'zgartirmang.
- Hajmi 5–40 KB, sizning 512 KB limitingizdan ancha past.

### 2.5. `/xapi/statements`

Xona tugaganda bir marta `{ statements: [...] }` yuboriladi (odatda 3–8 ta, limit 200). Shakli sizning talablaringizga mos:
- `actor.account.name = studentHash` (ism yoki `mbox` yo'q);
- har bir qaror uchun `answered` yoki `…/hinted` statement;
- oxirida `completed` statement: `result.score.scaled`, `result.duration` (ISO 8601);
- kengaytmalar: `https://lexsim.uz/xapi/{tone,article,better,seconds,hints,cohort}`.

---

## 3. Siz so'ragan fayllar (ilova)

### 3.1. `contracts.schema.json`
- 46 ta sxema, JSON Schema 2020-12, `$defs` ostida, `io: input` rejimida.
- Asosiylari: `Snapshot`, `Turn`, `TurnRequest`, `Interaction`, `CreateSession`, `Assessment`, `Hint`, `Level`, `InputMode`, `CourtScene`, `RemoteStatus`, `Case*`.
- Qayta yaratish: `node tools/contracts/export.mjs`.
- **Iltimos:** CI'da (§6.4) javoblaringizni shu sxemalarga qarshi tekshiring, ayniqsa `Snapshot` va `Turn`.

### 3.2. Ovoz ro'yxati — `lines.json` (+ render skripti)
- **97 ta takrorlanmas gap.** Bular "Ish yo'li" xonalarining (mehnat va o'g'rilik ishlari) barcha qat'iy gaplari. Siz Chatterbox'da render qilayotgan 61 ta iqtisodiy sud gapi bunga kirmaydi, ular alohida.

| Ovoz | Soni | Kimlar |
|---|---|---|
| `elder_m` | 37 | sudya, podpolkovnik |
| `male` | 36 | da'vogar, guvoh, navbatchi, tergovchi |
| `female` | 20 | devonxona, kotib, arizachi |
| `female_alt` | 4 | javobgar vakili |

- Format: `{ "voice", "text", "speaker", "case", "stage" }`.
- **Render'ni biz o'zimiz yuboramiz:** kalit qo'yilgach `node --env-file=.env.local tools/voice/prerender.mjs` ishga tushiriladi. U `POST /voice/prerender {items}` yuboradi va `GET /voice/prerender/{jobId}` ni poll qiladi.
- **So'rov:**
  - bu gaplar ham Chatterbox'da, rollarga mos ovoz bilan render qilinsin;
  - kesh kaliti matnni o'zgartirmasin: `ʻ` (U+02BB) va `ʼ` (U+02BC) apostrofga aylantirilmasin.

---

## 4. Ochiq muammolar (ustuvorlik bo'yicha)

### 🔴 B1. `/health` versiyasi va imkoniyatlar ro'yxati
`GET /health` hali ham `"version": "1.2.0"` qaytaryapti.

**Qabul mezoni:** `"1.3.x"` qaytsin va quyidagi massiv bo'lsin:
```
features: ["levels","reveal-options","silence","scripted","nlu","store","xapi","prerender","chatterbox"]
```
Frontend imkoniyatlarni shu orqali yoqadi.

### 🟠 B2. Advanced darajada LLM (qolgan qism)
D6 beginner va intermediate'ni hal qildi. `advanced` da bankdan mos javob topilmasa, hali ham 60–110 s lik LLM'ga tushadi. Bu yechim server egasining qaroriga bog'liq (§3 rejangiz: `llama.cpp`, bitta NUMA tugun, `security-agent` kvotasi). Biz rejangizni qo'llab-quvvatlaymiz.

**Qabul mezoni:** advanced'da LLM javobi p50 ≤ 8 s, p95 ≤ 20 s. Yoki SSE `/stream`: birinchi so'z ≤ 3 s da chiqsin. Frontend SSE'ni 1 kunda ulaydi.

**Oraliq so'rov:** bank 25 ta variantdan 60–80 tagacha kengaytirilsin. Advanced'da LLM'ga tushish ulushini `/metrics` da ko'rsating (`fallback_ratio`).

### 🟠 B3. Beginner variantlari juda oson
Hozirgi namuna (vakolat lahzasi):

| id | Matn | Natija |
|---|---|---|
| v-1 | "…vakolatimni tasdiqlovchi ishonchnomani taqdim etaman." | to'g'ri |
| v-2 | "…ishonchnomam ish materiallariga topshirilgan, asl nusxasini ham taqdim etaman." | to'g'ri |
| v-3 | "…mijozimning ishonchnomasi asosida ishtirok etyapman, mana ishonchnoma." | to'g'ri |
| v-4 | "…vakilligimni mijozning o'zi tasdiqlaydi, hujjatni keyinroq olib kelaman." | xato |

Rad qilish lahzasida ham shunday: 3 ta to'g'ri, 1 ta ochiq-oydin xato ("ish menga murakkab ko'rinyapti").

**Muammo:** tasodifan bosganda ham 75% to'g'ri chiqadi, xato esa birinchi qarashda ko'rinib turibdi. Talaba o'ylamaydi.

**Talab (`options.json`):**
- 1–2 ta to'g'ri variant;
- 2 ta "deyarli to'g'ri" xato: noto'g'ri hujjat (masalan, ishonchnoma o'rniga advokat orderi yoki aksincha), noto'g'ri modda, noto'g'ri muddat yoki tartib;
- 0–1 ta qo'pol xato;
- uzunliklar ±20% oralig'ida;
- har bir variantning `feedback.message` i nega to'g'ri yoki noto'g'ri ekanini aytsin.

### 🟡 B4. STT: tezlik va `confidence`
- **Tezlik:** 5 s audio 37 s da tanilmoqda.
  **Qabul mezoni:** ≤ 3 s. Yechim: `whisper small` yoki `distil` + `int8`, LLM bilan alohida yadrolarda.
- **`confidence`:** agar kotib Whisper asosida bo'lsa, segmentlarning `avg_logprob` va `no_speech_prob` qiymatlaridan ishonchni hisoblab qaytaring. Masalan: `exp(mean(avg_logprob))`, `no_speech_prob > 0.6` bo'lsa 0.
  Shunda `low_stt` qoidangiz server STT'da ham ishlaydi. Hozir u faqat brauzer STT'sida ishlaydi.
- **WER:** 50–100 ta huquqiy gap to'plamini mentor bilan birga tayyorlaymiz.

### 🟡 B5. `feedback` matnlari aniqroq bo'lsin
1. Talaba "dalolatnoma imzolangan" dedi. Ish materiallarida (F3) dalolatnoma yo'q, shuning uchun `tone:"bad"` to'g'ri. Lekin matn umumiy: "Ish materiallariga zid da'vo (masalan, imzolangan hujjatni inkor etish)".
   **Talab:** qaysi fakt bilan zid ekani aytilsin: "Ish materiallarida dalolatnoma yo'q (F3) — sudga mavjud bo'lmagan dalilni aytish uni chalg'itadi."
2. Beginner'da to'g'ri javobga `"Qabul qilindi."` deyiladi. Beginner — o'rganish darajasi, shuning uchun to'g'ri javobda ham bir jumla bilan **nega** to'g'ri ekani va modda aytilsin.

### 🟡 B6. Kalitli API bo'yicha kichik talablar
- 401 va 403 javoblari tez qaytsin (< 50 ms), body'da `{error:{code,message}}` bo'lsin.
- Rate-limit `X-LexSim-Owner` bo'yicha bo'lsin (bu bajarilgan, tasdiqlaymiz). IP bo'yicha limit Next.js serverining IP'siga qo'llanmasin: barcha talabalar u orqali keladi.
- `/xapi/statements` → `200 {stored: n}`. `id` bo'yicha idempotent bo'lsin.

### ⚪ B7. Ovoz va lab sinxroni (ixtiyoriy)
`/voice/tts` javobiga `X-Duration-Ms` va, iloji bo'lsa, so'z vaqtlari (`X-Word-Timings: [[startMs,endMs],…]`) qo'shilsin. Hozir og'iz harakati ovoz balandligidan hisoblanadi. So'z vaqtlari lab sinxronini sezilarli yaxshilaydi.

---

## 5. Huquqiy qoida (o'zgarmaydi)

- **"Manba bo'lmasa, modda yo'q".** Bank javoblari, `feedback.article` va LLM faqat lex.uz'dan olingan tasdiqlangan paketdagi moddani keltira oladi. Paketda yo'q modda bo'lsa `article: null`.
- **`replies.json` va `options.json`:** har bir moddani (FK 326, FK 541, IPK 62, IPK 173 va boshqalar) lex.uz matni bilan qayta solishtiring. `llm_check` raqamlarni tekshiradi, lekin modda **mazmunini** tekshirmaydi.
- Tashkilot va ismlar to'qima ("Namuna …").
- Imlo: `oʻ`, `gʻ` — U+02BB; tutuq belgisi — U+02BC; "Oʻzbekiston Respublikasi".

---

## 6. Keyingi qadamlar

**Bizdan:**
1. Kalit qo'yilgach kalitli yo'llarni jonli tekshiramiz va natijani yuboramiz: NLU, saqlash va server restartidan keyin tiklash, xAPI, server ovozi, 97 gap render'i.
2. Mentor bilan birga: `rubric.facts`, nomzodlar uchun `examples`, `eval/nlu_<case>.jsonl` kalibrlash to'plami va STT WER to'plami.
3. B1 tayyor bo'lgach, frontend `features` ni o'qib, imkoniyatlarni avtomatik yoqadi.

**Sizdan (ustuvorlik bo'yicha):** B1, B3, B5, B4, so'ng server egasi rozi bo'lsa B2 (`llama.cpp` benchmark).

**Xavfsizlik:**
- Kalitni chat yoki hujjatga yozmang. Uni server egasi Next serverining `.env.local` fayliga o'zi qo'yadi.
- SSH parolini almashtirish va faqat kalit bilan kirish — server egasining navbatdagi ishi.

---

### Ilovalar
- `contracts.schema.json` — API shartnomalari, JSON Schema.
- `lines.json` — 97 ta "Ish yo'li" gapi (`/voice/prerender` uchun).
- `lexsim-web/tools/voice/prerender.mjs` — render skripti (kalit bilan ishlaydi).
