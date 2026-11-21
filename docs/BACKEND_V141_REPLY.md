# Frontend — backend v1.4.1 javobiga javob

**Kimga:** backend dasturchisi.
**Sana:** 2026-11-21.
**Server:** `https://lex-api.e-investment.uz/api/v1` (1.4.1).

**Ilovalar** (barchasi shu xabarda):
1. `lines.json` — yangilangan, 97 gap.
2. `LexSim_Backend_Vazifalar_v15.md` — **keyingi asosiy topshiriq**. Sizning javobingiz v14 ga yozilgan, v15 hali sizga yetib bormagan ko'rinadi.
3. `contracts.schema.json` — yangilangan.

---

## 1. Siz so'ragan tekshiruvlar (qayta ishga tushirildi)

| Tekshiruv | Natija |
|---|---|
| `live.mjs` | ✅ 8/8 |
| `economic.mjs` (brauzer, hisobotgacha) | ✅ konsolda xato yo'q |
| `voice-coverage.mjs`: sud zali | ✅ 43/43, hammasi `hit` |
| `voice-coverage.mjs`: "Ish yo'li" | ✅ 95/97 `hit`. Qolgan 2 tasi `429` bilan qaytgan (3-band), gaplarning o'zi keshda bor |
| `/health.voice.servedFromCache` | ✅ 0,997 |
| `decisions[].points`, e'tiroz, erta bosqich, vakolat, `beginner` tezligi, variantlar | ✅ hammasini tasdiqlaymiz |

Rahmat. Keshni ko'chirish va `ffmpeg` bilan bog'liq tushuntirishingiz to'g'ri, oldingi natijalarimiz shu sababli yomon chiqqan edi.

## 2. Hali tuzatilmagan

1. **`/voice/status` hali ham `"stt": null` qaytaradi.** Javobingizda `"stt":"server"` deyilgan, lekin bugun bir necha marta tekshirdik:
   ```json
   {"tts": "server", "stt": null, "voices": [...], "ttsEngine": "mms", "sttEngine": "gpu"}
   ```
   Biz vaqtincha `sttEngine` maydoniga qarab ishlayapmiz. Status tuzatilsin.
2. **STT GPU'da emas.**
   - Ikki marta o'lchadik: 2,6 s audio 14,6 s va 16,7 s da tanildi, javobda `"engine": "kotib"`.
   - Bu paytda `/health.voice.gpu.stt: true` turibdi.
   - Siz yozgan "4 s audio → 4,2 s" natijani olmadik. Ehtimol, so'rov GPU'ga yo'naltirilmayapti.
   - Iltimos, `engine: "gpu"` bilan qaytayotganini tekshiring.
3. **429 (tezlik cheklovi).**
   - Bitta talaba nomidan 140 ta TTS so'rovida 19 marta `429` oldik. Bunda keshdagi gaplar ham limitga sanaladi.
   - Bizda bu oddiy holat: keyingi 3 ta gapni oldindan yuklaymiz, "Amaliyot yozuvi" esa butun majlis ovozini bitta faylga yig'adi.
   - Kerak: keshdan qaytgan gap (`X-TTS-Cache: hit`) limitga sanalmasin (v15, 1.3-band).
4. **Chatterbox:** `/health.voice.gpu.chatterbox: false`. Avtomatik prerender 17 tadan 8 tasini qildi, qolgani GPU qaytishini kutyapti.
5. **Bir martalik 502** yana chiqdi: 21-noyabr, ~1 daqiqa, nginx'dan. Keyin o'zi tiklandi. Sessiyalar SQLite'da saqlangani yaxshi. Qayta ishga tushirishni talabalar ishlamaydigan vaqtga qo'ying.

## 3. Siz so'ragan narsalar

- **`npcTurn.engine`:** kontraktimizga qo'shildi (`script` / `bank` / `llm`). Har bir gapda saqlanadi va o'qituvchilar uchun LMS (xAPI) eksportiga gap bo'yicha, umumiy hisob bilan birga tushadi.
- **`servedFromCache`:** bu umumiy server ko'rsatkichi, shuning uchun talabaga ko'rsatmaymiz. `/monitor` da kuzatish yetarli.
- **`seed`, `court`, `difficulty`, `tags`, `summary`:** qabul qilindi. Hub va terminal ssenariylarni `GET /scenarios` dan dinamik oladi va tasodifiy tanlaydi.

## 4. Keyingi qadam — v15

v14 dagi "Asosiy yangi vazifa" bo'yicha qilganlaringiz (paket formati, `validate_scenario`, `engine`, kutishni yashirish) yaxshi.

**Keyingi topshiriq — `LexSim_Backend_Vazifalar_v15.md` (ilova). Qisqacha:**

| Bo'lim | Nima |
|---|---|
| 1 | STT, status va 429 (yuqoridagi 2-bo'lim) |
| 2 | Ovozlar palitrasi: har rolga bir nechta ovoz, ovoz aktyor jinsiga mos (`scene.voices`); TTS'da `emotion` |
| 3 | **Har bir gapga `emotion` va `gesture`.** Hozir hammasi `neutral`, shuning uchun aktyorlarning yuzi o'zgarmaydi. Biz `gesture` ni allaqachon ijro etamiz |
| 4 | 10 ta ssenariyning yuridik tekshiruvi va mentor imzolaydigan varaqa. **Diqqat:** ma'muriy nizo iqtisodiy sudga tegishli emas, shuning uchun ro'yxatdan olindi va «Yuk tashish» bilan almashtirildi |
| 5 | O'qituvchiga yozuv yuborish uchun `POST /records` (keyingi bosqich) |
| 7 | **Zal "tirik":** turmasdan gapirishga sudyaning tanbehi bosqichma-bosqich kuchayadi (1 → 2 → 3), tinglovchilar munosabati (`reactions`), maslahatxona, guvoh va boshqa lahzalar |

Frontend tomoni (nigohlar, mimika, eslatmalar, amaliyot yozuvi, PDF, Word va audio yuklab olish) tayyor va GitHub'da.

## 5. Qabul

```bash
curl -s https://lex-api.e-investment.uz/api/v1/voice/status    # "stt" null emas
node tools/qa/voice-coverage.mjs                               # FAIL 0, rate-limited waits 0
node tools/qa/live.mjs                                         # 8/8
```
