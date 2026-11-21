# LexSim — backend uchun vazifalar

**Yangilangan:** 2026-11-21, backend v1.4.6.
**Kimga:** backend dasturchisi.

Bu fayl doimiy yangilanadi: har safar shu fayl almashtiriladi.

---

## 0. Frontend bajardi (`LexSim_Frontend_Vazifalar.md` bo'yicha)

| # | Ish | Holat |
|---|---|---|
| 1 | `/nlu/match` → `situation`: «tushunmadim» o'rniga odamdek javob | ✅ |
| 2 | `npcTurn.audio`: ovozni javob bilan birga olish | ✅ |
| 3 | STT ishonchi | ✅ |
| 4 | STT tezligini o'lchash | ✅ (2-bo'lim) |
| 5 | Sud zali QA'si | ✅ 13/14 (1-bo'lim) |
| 6 | `male` ovozi | ✅ |

**Tafsilotlar:**
1. **`situation`.** Ustunlik tartibi: `situation` → `match` → `clarify` → «tushunmadim».
   - "Ish yo'li"da talabaning gapi yozuvga tushadi, so'zlovchi `replies[speaker]` dagi gapni navbat bilan aytadi, `emotion` yuzga qo'yiladi va bosqich o'zgarmaydi.
   - `tone: bad` → hisobotga xato sifatida, `note` bilan. `ethics: true` → −30 ball, aks holda −10.
   - **DXM'da** endi erkin gap ham `/nlu/match` ga ketadi. Fuqaro `replies.client` dagi gapni aytadi, so'kinish esa hisobotda qo'pollik deb yoziladi.
   - Unit testlar bilan tekshirildi. **Jonli sinov Netlify'da** bo'ladi, chunki mahalliy kalit yo'q.
2. **`npcTurn.audio`.** `audio.voice` biz tanlagan ovozga teng bo'lsa, `audio.url` dan yuklanadi va brauzer keshida doimiy saqlanadi. Aks holda `POST /voice/tts`.
3. **STT ishonchi.**
   - `lowConfidence` bo'lsa, matn ishonch belgisi bilan yuboriladi: sudda `turns.stt = {confidence, durationMs}`, "Ish yo'li"da `stt.confidence`. Natijada sudya yoki aktyor ovoz chiqarib qayta so'raydi, ball ayirilmaydi.
   - Brauzer o'zi tanigan matn bo'lsa, o'sha ishlatiladi.
4. **STT o'lchovi:** 2-bo'limga qarang.
5. **Sud zali QA'si.** Yangi yo'llar qo'shildi: «ha», ma'nosiz gap, 3 marta so'kinish, bahona.
6. **`male` ovozi.** Bizning server keshi 2 soatda yangilanadi.

**Testlar:** 51/51. Brauzerdagi to'liq oqimlar (sud, "Ish yo'li", DXM) konsol xatolarisiz o'tdi.

---

## 🔴 1. Yuridik xato: «ishonchnoma uyda qolib ketibdi» → «Vakolat tekshirildi»

**Takrorlash** (`advanced`, sud zali, vakolat bosqichi):
```
turn «Hurmatli sud, ishonchnoma uyda qolib ketibdi.»
→ [judge] «Vakolat tekshirildi.» → majlis davom etadi
```

Hujjat yo'q, lekin vakolat **tasdiqlandi**: gapda «ishonchnoma» so'zi bor-ku. Yuridik jihatdan noto'g'ri va talabaga noto'g'ri saboq beradi. Sizning hujjatingizdagi (v1.4.6) kutilgan javob: «Tushunaman… lekin hujjatsiz sud sizni vakil sifatida qo'ya olmaydi…».

**Kerak:** vakolat bosqichida inkor va bahonalar («uyda qoldi», «yo'q», «olib kelmadim», «unutibman», «keyin beraman») «ishonchnoma» so'zidan **ustun** tursin. Ikkinchi marta takrorlansa, `advanced` darajada vakil majlisga qo'yilmasin.

**Qabul:** `node tools/qa/live.mjs` → «an excuse is answered» va «not admitted» ✓ bo'lsin. Hozir 13/14.

---

## 🔴 2. STT: vaqti-vaqti bilan 30–45 s qotish

**O'lchov** (`tools/qa/stt-timing.mjs`, 20 ta klip, 1,8–5,6 s, 16 kHz mono WAV, GPU yoniq, 21-noyabr 11:30):

| Ko'rsatkich | p50 | p95 |
|---|---|---|
| Server: `total` | **2,84 s** | **39,8 s** |
| `model` | 2,26 s | 39,3 s |
| `upload` (tunnel) | 0,59 s | 0,84 s |
| To'g'ridan-to'g'ri sizga | 3,40 s | 40,7 s |
| Bizning server orqali | 3,36 s | 45,0 s |

**Xulosa:**
- **Bizning server vaqt qo'shmaydi** (3,36 s va 3,40 s).
- **Oddiy holatda** `total` 2,84 s. Siz o'lchagan 1,8 s dan sekin, `upload` ning o'zi 0,6 s.
- **20 tadan 4 tasida `model` 6–40 s** davom etdi. Shu payt `/health` da `autoPrerender: 17/173 ishlayapti`, `voice.stt.p95Ms: 26295`. Ya'ni **STT va ovoz renderi bitta GPU'da navbat talashyapti.**

**Kerak:**
1. **STT birinchi navbatda.** Talaba so'rovi render ishidan doim oldin o'tsin: ustuvor navbat, yoki STT kelganda render pauza qilinsin.
2. **Katta renderni kechasi qiling** (22:00 dan keyin), xuddi qayta ishga tushirish kabi. Kunduzi faqat bir nechta yangi gap.
3. **`upload` ni kamaytirish:** tunnelda ulanishni qayta ishlating (keep-alive) yoki audioni siqib yuboring (Opus yoki FLAC).

**Qabul:** kunduzi, render ketayotgan paytda ham 20 ta klipda `total` p95 ≤ 3 s.

---

## 🟠 3. Ovoz qamrovi (`male` qayta yozilgandan keyin)

`voice-coverage.mjs` (11:40):
- sud zali **38/45** `hit` (7 tasi `miss`, lekin render qilindi);
- "Ish yo'li" **82/115** `hit`. `FAIL 0`.

Render tugagach, ikkalasi ham to'liq `hit` bo'lishi kerak. Tugaganda xabar bering, men qayta o'lchayman.

---

## 🟠 4. `situation` bo'yicha savollar

1. **DXM fuqarosi** uchun qaysi `replies` kaliti? Biz `client` ishlatyapmiz (DXM'ga kelgan fuqaro — mijoz). Alohida `citizen` kerak bo'lsa, qo'shing, biz moslaymiz.
2. **`situation` ga `audio` qo'shsa bo'ladimi** (xuddi `npcTurn.audio` kabi, har bir gap uchun)? Hozir matn bo'yicha `POST /voice/tts` qilyapmiz. Prerender bo'lsa tez, lekin `audio` bilan pauza umuman bo'lmaydi.
3. Bitta haqiqiy `/nlu/match` javobini (`situation` bilan) misol sifatida yuboring. Unit testimiz sizning hujjatingizdagi shaklga yozilgan, real javob bilan solishtirib qo'yamiz.

---

## Keyinroq — loyiha egasining qarorlaridan keyin

| # | Ish | Nimani kutadi |
|---|---|---|
| B4 | Ovozlar palitrasi, `scene.voices` | Ovoz namunalari |
| B5 | 9 ta ssenariy | Mentor |
| B6 | Erkin gapga jonli javob (LLM) | Tez LLM kaliti |
| B7 | `POST /records` | Saqlash siyosati |

---

## Tekshirish (frontend repo, `lexsim-web`)

```bash
node tools/qa/live.mjs                              # 14/14
node tools/qa/stt-timing.mjs <20 ta wav papka>      # total p95 ≤ 3 s
node tools/qa/voice-coverage.mjs                    # hit to'liq, FAIL 0
```
