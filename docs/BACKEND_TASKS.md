# LexSim — backend uchun ochiq vazifalar

**Yangilangan:** 2026-11-21, backend v1.4.4.
**Kimga:** backend dasturchisi.

Bu fayl **doimiy yangilanib boradi**: har safar shu fayl almashtiriladi, yangi `vNN` ochilmaydi.

Batafsil topshiriqlar:
- `LexSim_Backend_Vazifalar_v14.md` — ssenariylar, improvizatsiya;
- `LexSim_Backend_Vazifalar_v15.md` — ovoz, mimika, yuridik tekshiruv, "tirik" zal.

Umumiy reja `LexSim_HOLAT.md` da.

---

## v1.4.4 ni tekshirdik — rahmat

| Ish | Holat |
|---|---|
| B1: `sit-at-desk` dan keyin `standing = false` | ✅ |
| B2: `presence`, `context` signallari | ✅ |
| B9: ombor (`dxm-session`, `hearing`, muddat, 600/daq, boshqa talabaga 404) | ✅ frontend shu ombordan foydalanmoqda: DXM, raislik majlisi va "Ish yo'li" serverless'da yo'qolmaydi |
| Kalit Netlify'da | ✅ |

---

## 🔴 Hozir

### 1. Talaba ovozi: eng katta muammo — tezlik va aniqlik

**Jonli sinovda nima bo'ldi:**
- talaba "Ish yo'li" xonasida gapirdi;
- STT **CPU'da** ishladi, chunki GPU kompyuter o'chiq edi;
- talaba 15–40 s faqat «Tushunilmoqda…» ni ko'rib turdi;
- natija noto'g'ri matn bo'ldi: «koʻtni tozalash kerak koʻtni.»;
- xona uni tushunmadi.

Bu foydalanuvchi uchun "qotib qoldi" degani.

**Frontendda qilindi:**
- **Gapirayotganda so'zlar jonli ko'rinadi.** Ular brauzerning o'z tanishidan olinadi.
- **Server 4 s ichida javob bermasa** yoki `/voice/status` `"stt": "cpu"` desa, brauzer eshitgan matn bilan darhol davom etiladi. Talaba yarim daqiqa kutmaydi.
- **Tushunilmagan javobga** aktyor endi ovoz chiqarib, o'z uslubida qayta so'raydi (3-band). Avval faqat yozuv chiqar edi.

**Sizdan:**
1. **GPU STT doim ishlasin.** Loyiha egasi bilan birga: kompyuter uxlamasin, quvvat sozlamasi to'g'ri bo'lsin. Tunnel uzilsa, o'zi qayta ulansin (`autossh` yoki systemd `Restart=always`).
2. **Tezlik ≤ 2,5 s** (hozir ~4 s, tunnel qadamlari).
3. **CPU zaxirasida aniqlik.** «koʻtni tozalash…» kabi natija tushunishni buzadi.
   - CPU Kotib ishonchsiz matn bersa (masalan, lug'atdan tashqari so'zlar ko'p bo'lsa), bo'sh matn yoki past `confidence` qaytaring. Shunda frontend talabadan qayta aytishni so'raydi va noto'g'ri gap yuborilmaydi.
   - Shu maqsadda **`confidence`** maydonini to'ldiring. Biz bunga tayyormiz.
4. `/health.voice` ga **STT kechikishi** (p50, p95) va **CPU zaxirasi necha marta ishlagani** qo'shilsin, `/monitor` da ko'rinsin.

### 2. Yangi `lines.json` (115 gap) — prerender

Ro'yxat 97 tadan **115** taga oshdi. Yangilari: tushunilmagan javobga **qayta so'rash** gaplari, har bir rol uchun o'z uslubida.
- Rasmiy (sudya, kotib, tergovchi va boshqalar): «Kechirasiz, fikringizni tushunmadim. Aniqroq ayting, iltimos.», «Iltimos, qisqa va aniq bayon qiling.», «Yana bir bor takrorlang, iltimos.»
- Oddiy (mijoz, guvoh, taraf): «Kechirasiz, tushunmadim. Yana bir bor aytasizmi?», «Uzr, nima demoqchi ekaningizni tushunmadim.», «Bir oz soddaroq tushuntirib bering.»

Faylni `backend/voice_lines.json` ga qo'ying, avtomatik render o'zi yozadi.

**Qabul mezoni:** `node tools/qa/voice-coverage.mjs` → `case lines 115 hit 115`.

### 3. Sud zalida ham xuddi shunday qayta so'rash

"Ish yo'li"da endi talabani tushunmasa, aktyor ovoz chiqarib qayta so'raydi. Sud zalida (`/sessions/*/turns`) sudyaning aniqlashtiruvchi gapi allaqachon bor. Uning **talabaning matni ishonchsiz bo'lganda ham** ishlashini tekshiring: bo'sh yoki ma'nosiz matn `turn` sifatida kelsa, sudya «Aniqroq ayting» deydi va bosqich o'zgarmaydi.

---

## 🟠 Loyiha egasidan keyin

| # | Ish | Nimaga bog'liq | Batafsil |
|---|---|---|---|
| B4 | Ovozlar palitrasi, `scene.voices`, emotsiya variantlari | Ovoz namunalari va rozilik | v15 2 |
| B5 | 9 ta ssenariy, linter (sana, summa, `scene.papers` ↔ `evidence`), qaror qoidalari | Mentor | v14 1, 7; v15 4 |
| B6 | Improvizatsiya ≤ 3 s, jonli gap klon ovozda | Tez LLM kaliti | v14 2, 5 |
| B7 | `POST /records`, `GET /teacher/records` | Saqlash siyosati | v15 5 |

## 🟢 Kichik

- **B8** `npcTurn.audio = {id, durationMs}`.
- **B10** Guvoh: guvoh bor ssenariy bilan birga.
- **v1.5:** sarlavhasiz `GET /store` → 422. Biz doim `X-LexSim-Owner` yuboramiz, bizga ta'sir qilmaydi.

---

## Tekshirish (frontend repo, `lexsim-web`)

```bash
curl -s https://lex-api.e-investment.uz/api/v1/voice/status   # "stt":"gpu"
node tools/qa/voice-coverage.mjs                              # FAIL 0; case 115/115
node tools/qa/live.mjs                                        # 8/8
```

**Ilovalar:** `lines.json` (115 gap), `contracts.schema.json`.
