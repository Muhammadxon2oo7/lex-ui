# LexSim — backend uchun vazifalar (qadamma-qadam)

**Yangilangan:** 2026-11-21, backend v1.4.4.
**Kimga:** backend dasturchisi.
**Server:** `https://lex-api.e-investment.uz/api/v1`.

Bu fayl doimiy yangilanadi: har safar shu fayl almashtiriladi, yangi `vNN` ochilmaydi.

**Tartib:** 1 → 7. Har bir ish oxirida "Qabul" bandi bor. Shu tekshiruv o'tsagina ish bajarilgan hisoblanadi.

**Ilovalar:** `lines.json` (115 gap), `contracts.schema.json`.

---

## 0. Qisqacha: nega shu tartib

21-noyabrdagi jonli sinovda talaba "Ish yo'li" xonasida gapirdi va 15–40 s faqat «Tushunilmoqda…» ni ko'rdi. Natija noto'g'ri matn bo'ldi («koʻtni tozalash kerak koʻtni.»), muloqot buzildi. Sabab — GPU kompyuter o'chiq edi va STT CPU zaxirasida ishladi.

Frontend o'z tomonini tuzatdi:
- so'zlar gapirish paytida jonli ko'rinadi;
- server sekin bo'lsa kutilmaydi;
- tushunilmasa, aktyor ovoz chiqarib qayta so'raydi.

**Lekin asosiy tuzatish sizda: STT tez, barqaror va aniq bo'lishi kerak.** 1–3-ishlar shu haqda.

---

## 1. STT kanali hech qachon uzilmasin

**Nima:** GPU kompyuter bilan aloqa (tunnel) uzilsa, o'zi qayta ulansin. GPU o'chsa, darhol xabar kelsin.

**Qanday:**
1. Tunnelni oddiy `ssh -L/-R` bilan emas, `autossh` bilan va systemd xizmati sifatida ishga tushiring:
   ```ini
   # /etc/systemd/system/lexsim-gpu-tunnel.service
   [Service]
   ExecStart=/usr/bin/autossh -M 0 -N -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes <tunnel-buyrug'ingiz>
   Restart=always
   RestartSec=5
   [Install]
   WantedBy=multi-user.target
   ```
2. GPU kompyuterda: uxlash rejimi va o'chib qolish o'chirilsin (loyiha egasi bilan birga). Elektr tiklanganda kompyuter o'zi yonsin (BIOS: *Restore on AC power loss*). GPU xizmatlari ham systemd'da, `Restart=always` bilan ishlasin.
3. `/health.voice.gpu.*` 2 daqiqadan ko'p `false` bo'lsa, loyiha egasiga xabar keladi (Telegram bot yoki email).

**Qabul mezoni:**
- tunnel jarayonini `kill` qilgandan keyin ≤ 30 s ichida `/voice/status` yana `"stt":"gpu"` ko'rsatadi;
- GPU o'chirilganda xabar keladi.

---

## 2. STT tezligi ≤ 2,5 s

**Nima:** 5 soniyalik audio ≤ 2,5 s da tanilsin. Hozir GPU bilan ~4 s.

**Qanday:**
1. Bitta so'rovni bosqichlarga bo'lib o'lchang (logda ms bilan):
   - qabul;
   - formatni o'zgartirish (ffmpeg);
   - tunnel orqali GPU'ga yuborish;
   - model;
   - qaytarish.
2. Tunnelda doimiy ulanish (keep-alive / HTTP connection pool) ishlating, har so'rovda yangi ulanish ochilmasin.
3. Audioni GPU'ga yuborishdan oldin 16 kHz mono PCM'ga keltiring. Biz allaqachon shunday yuboryapmiz, qayta kodlash shart emas: `Content-Type: audio/wav`, 16 kHz, mono, 16-bit.
4. Model GPU'da doim yuklangan holda tursin (warm), birinchi so'rov sekin bo'lmasin.

**Qabul mezoni:** 20 ta 5 soniyalik audio uchun p95 ≤ 2,5 s. Natijani `/health` da ko'rsating (3-ish).

---

## 3. STT ishonchsiz bo'lsa — noto'g'ri matn bermang

**Nima:** CPU zaxirasi yoki shovqin «koʻtni tozalash…» kabi matn berganda, bu matn talabaning javobi sifatida ketmasin.

**Qanday:**
1. Har bir natijaga **`confidence`** (0–1) hisoblang. Model bermasa, oddiy baholash ham yetadi:
   - so'zlarning necha foizi o'zbek lug'atida yoki ssenariy lug'atida bor;
   - takrorlanish (bir so'z ketma-ket 2+ marta);
   - audio uzunligiga nisbatan so'zlar soni.
2. `confidence < 0,5` bo'lsa, `text` ni qaytaring, lekin `"lowConfidence": true` belgisini qo'ying.
3. **`POST /sessions/{id}/turns`** da `stt.confidence < 0,5` kelsa, sudya bosqichni o'zgartirmasdan aniqlashtiradi («Aniqroq ayting, iltimos.») va ball ayirilmaydi.
4. `/health.voice` ga qo'shing:
   ```json
   "stt": { "engine": "gpu", "p50Ms": 1800, "p95Ms": 2400, "cpuFallbacks24h": 3, "lowConfidence24h": 5 }
   ```

**Biz nima qilamiz:** `confidence` kelishi bilan uni `turns.stt.confidence` da sizga qaytarib yuboramiz. Ishonchsiz natijada talabaning o'zidan qayta aytishni so'raymiz, noto'g'ri gapni yubormaymiz.

**Qabul mezoni:** shovqin yoki ma'nosiz audio → `lowConfidence: true`; aniq gap → `confidence ≥ 0,7`.

---

## 4. Yangi `lines.json` (115 gap) — oldindan ovozlashtirish

**Nima:** ro'yxat 97 tadan 115 taga oshdi. Yangilari — tushunilmagan javobga **qayta so'rash** gaplari, har bir rol uchun o'z uslubida:
- **rasmiy** (sudya, kotib, tergovchi, boshliq, navbatchi):
  - «Kechirasiz, fikringizni tushunmadim. Aniqroq ayting, iltimos.»
  - «Iltimos, qisqa va aniq bayon qiling.»
  - «Yana bir bor takrorlang, iltimos.»
- **oddiy** (mijoz, guvoh, taraf):
  - «Kechirasiz, tushunmadim. Yana bir bor aytasizmi?»
  - «Uzr, nima demoqchi ekaningizni tushunmadim.»
  - «Bir oz soddaroq tushuntirib bering.»

**Qanday:** ilova qilingan `lines.json` ni `backend/voice_lines.json` ga qo'ying. Avtomatik render qolganini o'zi yozadi.

**Qabul mezoni:** `node tools/qa/voice-coverage.mjs` → `case lines 115 hit 115`, `FAIL 0`.

---

## 5. Sud zalida ham qayta so'rash

**Nima:** bo'sh, juda qisqa yoki ma'nosiz `turn` matni kelsa, sudya qayta so'rasin:
- bosqich o'zgarmasin;
- ball ayirilmasin;
- `decisions[]` ga `info` yozilsin.

**Qanday:**
- shart: matn ≤ 2 so'z va «Hurmatli sud»dan boshqa mazmun yo'q, yoki 3-ishdagi `lowConfidence`;
- sudya gaplari (2–3 variant, prerender ro'yxatiga):
  - «Vakil, fikringizni aniqroq bayon qiling.»
  - «Sud sizni tushunmadi. Qisqa va aniq ayting.»
  - «Iltimos, savolga mazmunan javob bering.»
- `emotion: "uncertain"`, `gesture: "lean-in"`.

**Qabul mezoni:** `turn {text: "ha"}` va `turn {text: "koʻtni tozalash kerak"}` → sudya qayta so'raydi, bosqich o'zgarmaydi.

---

## 6. `npcTurn.audio` — ovozni javob bilan birga berish

**Nima:** oldindan ovozlashtirilgan gap uchun `npcTurn` ichida audio ma'lumoti. Shunda frontend TTS'ni alohida so'ramaydi va gap darhol eshitiladi.

**Format:**
```json
"audio": { "id": "a7f3…", "url": "/api/v1/voice/cache/a7f3….mp3", "durationMs": 2840, "voice": "elder_m" }
```

**Qanday:**
- `url` — kalit yoki cookie bilan ochiladigan GET, `Cache-Control: max-age=31536000, immutable` (kesh kaliti `voice + matn` xeshi);
- gap keshda bo'lmasa, `audio` maydonini qo'ymang. Biz odatdagidek `POST /voice/tts` qilamiz.

**Qabul mezoni:** sud zalidagi kanonik gaplarning ≥ 90 % ida `audio` bor.

---

## 7. Kichik ishlar

- **Guvoh:** guvoh bor birinchi ssenariy bilan birga. Javobgarlikni tushuntirish moddasini mentor beradi, guvohga `uncertain`/`confused` munosabatlar.
- **v1.5:** sarlavhasiz `GET /store` → 422. Biz doim `X-LexSim-Owner` yuboramiz, bizga ta'sir qilmaydi.
- **Qayta ishga tushirish:** faqat talabalar ishlamaydigan vaqtda (kech soat 22:00 dan keyin).

---

## Keyinroq — loyiha egasining qarorlaridan keyin

| # | Ish | Nimani kutadi | Batafsil |
|---|---|---|---|
| B4 | Ovozlar palitrasi, `scene.voices`, emotsiya variantlari | Ovoz namunalari va rozilik | v15, 2-bo'lim |
| B5 | 9 ta ssenariy, linter (sana, summa, `scene.papers` ↔ `evidence`), qaror qoidalari | Mentor | v14 1, 7; v15 4 |
| B6 | Improvizatsiya ≤ 3 s, jonli gap klon ovozda | Tez LLM kaliti | v14 2, 5 |
| B7 | `POST /records`, `GET /teacher/records` | Saqlash siyosati | v15, 5-bo'lim |

---

## Tekshirish (frontend repo, `lexsim-web`)

```bash
curl -s https://lex-api.e-investment.uz/api/v1/voice/status   # "stt":"gpu"
curl -s https://lex-api.e-investment.uz/api/v1/health         # voice.stt.p95Ms ≤ 2500
node tools/qa/voice-coverage.mjs                              # FAIL 0; case 115/115
node tools/qa/live.mjs                                        # 8/8
```

Ish tugagach, javobingizda har bir band uchun **«Qabul» natijasini** yozing: raqamlar bilan.
