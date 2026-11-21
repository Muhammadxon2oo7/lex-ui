# LexSim — backend uchun ochiq vazifalar (v16)

**Kimga:** backend dasturchisi.
**Sana:** 2026-11-21.
**Server:** `https://lex-api.e-investment.uz/api/v1` (1.4.2).

Bu fayl faqat **ochiq** ishlarni jamlaydi. To'liq texnik topshiriqlar avvalgidek:
- v14 — ssenariylar va improvizatsiya;
- v15 — ovoz, mimika, yuridik tekshiruv, "tirik" zal.

Umumiy reja va kim nima qilishi `LexSim_HOLAT.md` da.

**v1.4.2 ni jonli tekshirdik:**
- emotsiya, imo-ishora, `reactions`, `engine` keladi;
- tanbeh zinapoyasi ishlaydi: 1 → 2 → 3;
- ovoz: "Ish yo'li" 97/97, sud zali 43/44, birorta ham 429 yo'q;
- STT status to'g'ri;
- jonli sud 8/8.

Rahmat!

---

## 🔴 Hozir (hech narsaga bog'liq emas)

### B1. Tik turish holati noma'lum bo'lsa, tanbeh ishlamaydi

- **Holat:** `start` va `sit-at-desk` dan keyin `snapshot.standing` maydoni yo'q (`null`). Talaba G'ni umuman bosmasa, sudya o'tirib gapirishga **hech qachon** tanbeh bermaydi. Tekshirdik: 6 ta gap o'tirgan holda aytildi, tanbeh bo'lmadi.
- **Aniq `sit` yuborilsa,** zinapoya birinchi gapdan ishlaydi.
- **Kerak:** `sit-at-desk` dan keyin `standing = false` bo'lsin (talaba o'z joyida o'tiradi).
- **Frontendda vaqtincha:** zalga kirishda `sit` yuboramiz. Siz tuzatgach ham bu zarar qilmaydi.
- **Qabul mezoni:** `start → sit-at-desk → turn` (`stand` va `sit` siz) birinchi gapdayoq tanbeh beradi.

### B2. Siz so'ragan signallar tayyor, ularni ishlating

Frontend hozir **har bir** so'rovda quyidagi signallarni yuboryapti (`200` qaytadi).

**`POST /turns` → `presence`:**
```json
"presence": { "heardTurnId": "t_41", "spokenSeconds": 94.2, "standing": false }
```

**`POST /interactions` (`stand`/`sit`) → `context`:**
```json
"context": { "during": { "turnId": "t_42", "role": "opponent" } }
```

**Frontend kafolati:** talabaning javobi faqat oldingi barcha gaplar oxirigacha eshitilgandan keyin yuboriladi. O'yinchi NPC gapirayotganda javob yuborishga ruxsat bermaydi, shuning uchun bizda "gap bo'lish" bo'lmaydi.

**Ulash kerak:**

| Signal | Qoida | Zinapoya |
|---|---|---|
| `presence.spokenSeconds > 90` | Sudya muloyim to'xtatadi: «Qisqaroq, mohiyatini ayting.» (hozir faqat > 120 so'z bo'yicha) | v15 7.4-5 |
| `context.during.role = "opponent"` va `action = "stand"` | Raqib gapirayotganda turdi → keyingi sudya gapida yengil «Oʻtirishingiz mumkin», ballsiz | v15 7.4-3 |
| `presence.heardTurnId` ≠ oxirgi NPC gapi | Bo'lmasligi kerak. Agar shunday bo'lsa, log qiling (frontend xatosi) | — |

### B3. STT tezligi

GPU bilan ~4 s, mezon ≤ 2,5 s (tunnel qadamlari). O'zingiz aytgandek qisqartiring.

### B9. **Yangi:** serverless uchun ombor — DXM sessiyalari va raislik majlislari

**Nega:** frontend Netlify'da (serverless) ishlaydi. Har bir so'rov yangi nusxaga tushishi mumkin, xotira esa bo'sh bo'ladi. Shuning uchun frontend endi xotiradagi holatni sizning omboringizga yozib boradi va keyin o'qib oladi. Bu avval faqat "Ish yo'li" ishlari uchun ishlardi, endi:

| Hujjat `id` | `kind` | Kim | Qachon yoziladi |
|---|---|---|---|
| `{caseId}`, `idx-…-{kind}` | ish turi, `index` | "Ish yo'li" | har harakatdan keyin (avvaldan) |
| `dxm-{sessionId}` | `dxm-session` | DXM | yaratilganda va har o'zgarishdan keyin |
| `hearing-{hearingId}` | `hearing` | raislik qiluvchi majlisi | yaratilganda va har harakatdan keyin |

Hammasi `PUT/GET /store/cases/{id}` orqali, `X-LexSim-Key`, `owner` hash va `version` bilan, javobdan keyin (talaba kutmaydi).

**Kerak:**
1. `/store/cases` **har qanday `kind`** ni qabul qilsin, kamida `dxm-session` va `hearing` ni.
2. **Hajm:** DXM sessiyasi 30–150 KB. 512 KB chegarasi yetadi, o'zgartirmang.
3. **Tezlik:** bitta talaba har bir gapda 1 ta yozuv yuboradi, ish yo'lida 2 ta. Yozuv limiti talaba boshiga ≥ 120/daq bo'lsin.
4. **Saqlash muddati:**
   - `dxm-session` va `hearing` — 7 kun;
   - ish (`case`) va `index` — 180 kun (E6 tasdiqlangach).
   - Muddat o'tgani tozalanadi.
5. **Egasi tekshiruvi:** boshqa talabaning hujjati `GET` da 404 qaytsin, 403 emas, shunda mavjudligi ham bilinmaydi.

**Qabul mezoni:**
- kalit bilan `PUT /store/cases/dxm-test-1 {kind:"dxm-session"}` → 200;
- `GET` → o'sha holat;
- boshqa `X-LexSim-Owner` bilan `GET` → 404.

---

## 🟠 Loyiha egasidan keyin (navbat bilan)

| # | Ish | Nimaga bog'liq | Batafsil |
|---|---|---|---|
| B4 | Ovozlar palitrasi: klonlash, `scene.voices`, emotsiya variantlarini render | Ovoz namunalari va rozilik (E3) | v15 2 |
| B5 | 9 ta ssenariy paketi; linterga sana va summa tekshiruvi, `scene.papers` ↔ `evidence` mosligi; qaror qoidalari | Mentor (E4, M1, M2) | v14 1, 7; v15 4 |
| B6 | Improvizatsiya ≤ 3 s, «qisqa bo'lak + tayyor javob», jonli gap klon ovozda (gapma-gap) | Tez LLM kaliti (E5) | v14 2, 5 |
| B7 | `POST /records`, `GET /teacher/records` | Saqlash siyosati (E6) | v15 5 |

## 🟢 Kichik, istalgan vaqtda

| # | Ish |
|---|---|
| B8 | `npcTurn.audio = {id, durationMs}`. Shunda frontend ovozni javob bilan bir vaqtda yuklaydi |
| B10 | Guvoh bor ssenariy kelganda: guvohning javobgarligini tushuntirish (moddani mentor beradi) va guvohga `uncertain` / `confused` munosabatlari |
| B11 | Qayta ishga tushirishlarni talabalar ishlamaydigan vaqtga qo'ying. 21-noyabr kuni kunduzi 1 daqiqalik 502 bo'ldi |

---

## Tekshirish (frontend repo, `lexsim-web`)

```bash
curl -s https://lex-api.e-investment.uz/api/v1/health     # voice.gpu, coverage
node tools/qa/live.mjs                                     # 8/8
node tools/qa/voice-coverage.mjs                           # FAIL 0, rate-limited waits 0
```

**Ilova:** yangilangan `contracts.schema.json` (`presence`, `context`).
