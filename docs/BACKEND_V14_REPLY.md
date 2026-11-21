# LexSim frontend — backend v1.4.0 bo'yicha javob

**Kimga:** backend dasturchisi.
**Sana:** 2026-11-21.
**Server:** `https://lex-api.e-investment.uz/api/v1` (1.4.0, `live-procedure` bor).

---

## 1. Qisqacha

**Frontend tomondan qilingan ishlar:**
- Frontend yangi domenga o'tkazildi.
- Hamma narsa bizning Zod adapterimiz orqali sinaldi. Bitta ham sxema xatosi chiqmadi.
- Azure butunlay olib tashlandi. Ovoz endi faqat sizdan keladi. Server javob bermasa, brauzer ovozi zaxira bo'lib ishlaydi.

**Jonli sud:** 8 ta tekshiruvdan 7 tasi o'tdi.

**Siz tomondan 5 ta ish qoldi.** Eng muhimlari: kalit, keshda yo'q gapning TTS'i va e'tiroz.

## 2. Frontendda nima qilindi

| Nima | Holat |
|---|---|
| `LEXSIM_REMOTE_URL` endi `https://lex-api.e-investment.uz/api/v1` | ✅ |
| Azure olib tashlandi; TTS va STT faqat sizning serverdan | ✅ |
| `voice` rolga qarab yuboriladi: `judge` → `elder_m`, `secretary` → `female`, `opponent` → `female_alt`, `witness`/`expert` → `male`; `system` ovozlashtirilmaydi | ✅ (avvaldan to'g'ri edi) |
| `npcTurn.text` TTS'ga o'zgarishsiz yuboriladi (kesh shu matn bo'yicha ishlaydi) | ✅ |
| Server STT'da `turns.stt` yuborilmaydi | ✅ |
| **Harakat chiplari** sud zalida: «Raqibga savol», «Iltimosnoma», «Eʼtiroz», «Kelishuv». Chip gapning boshini yozib beradi, talaba o'zi davom ettiradi. `advanced` darajada chiplar yo'q | ✅ yangi |
| Majlis o'rtasida `report-ready` bo'lsa, «Hisobotni ochish» tugmasi chiqadi | ✅ |
| Playwright/QA: `tools/qa/live.mjs` (jonli sud yo'llari, bizning API orqali) | ✅ yangi |

## 3. QA natijasi (`node tools/qa/live.mjs`, 2026-11-21)

| Yo'l | Natija | Vaqt |
|---|---|---|
| Zaif javob → sudya aniqlashtiradi | ✅ | 0,13 s |
| Raqibga savol → raqib javob beradi, fakt ochiladi | ✅ | 0,8–1,1 s |
| Guvoh iltimosnomasi → raqib fikri → ajrim | ✅ | 0,15 s |
| Keyinga qoldirish → rad (IPK 171) | ✅ | 0,15 s |
| Kelishuv taklifi → raqib sharti → «yozma bitim kerak» | ✅ | 0,2 s |
| `advanced` + vakolatsiz → vakil qo'yilmaydi, `report-ready` | ✅ | — |
| **E'tiroz → sud qaror qiladi** | ❌ (2-ish) | 0,5 s |
| Keshdagi gap TTS | ✅ `X-TTS-Cache: hit` | 0,01 s (sizda) / 0,3 s (bizdan) |
| **Keshda yo'q gap TTS** | ❌ (1-ish) | — |

Tezlik juda yaxshi: talabaning gapiga javob 0,1–1,3 s da keladi. Ish 2 da LLM'li to'liq da'vo javobi 3 s oldi.

---

## 4. Sizdan kerak

### 1-ish. Keshda yo'q gap uchun TTS 504 qaytaryapti

Oldindan yozilmagan har qanday gap `504` qaytaryapti. MMS zaxira ovozi ishlamayapti.

```bash
curl -s -b jar -X POST https://lex-api.e-investment.uz/api/v1/voice/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"Daʼvogar vakili, talablaringiz va ularning asoslarini bayon qiling.","voice":"elder_m"}'
→ 504 {"error":{"code":"voice_timeout","message":"Ovoz xizmati javob bermadi (FileNotFoundError)"}}
```

`jar` — `POST /sessions` dan olingan `lexsim_owner` cookie.

**Kutilgan natija:** hujjatdagidek, MMS bilan 1–2,5 s da audio qaytsin. Bu sodir bo'lganda talaba sudyani boshqa (brauzer) ovozida eshitadi.

**Oldini olish uchun:** jonli sudning barcha gaplari, jumladan quyidagi 5-ishdagi variantlar, prerender ro'yxatida bo'lsin.

### 2-ish. Sudyaning savoli ochiq turganda e'tiroz tanilmayapti

**Takrorlash:**
1. Majlisni mazmunan ko'rish bosqichiga olib boring.
2. To'liq da'vo bayon qiling.
3. Raqib «obyekt dalolatnoma bilan topshirilmagan» deydi.
4. Sudya «…Bunga munosabatingiz?» deb so'raydi.
5. Talaba aytadi: «Hurmatli sud, javobgar vakilining gapiga eʼtiroz bildiraman, chunki obyekt topshirilmagani haqidagi gap hech qanday dalil bilan tasdiqlanmagan.»

**Hozir:** sudya «savolga aniq javob bering…» deydi, feedback `info`: «Sudya aniqlashtirishni so'radi».

**Kutilgan natija:** «Sud e'tirozni qabul qildi» yoki «E'tiroz rad etildi…» (hujjatingizning 2-bo'limi).

Asossiz «Hurmatli sud, eʼtiroz bildiraman.» gapi ham shunday tanilmayapti.

### 3-ish. Erta bosqichlarda o'rinsiz harakat "to'g'ri javob" deb hisoblanib, bosqich o'tib ketyapti

Bu muammo vakolat tekshirilgandan keyingi bosqichlarda chiqyapti:

| Bosqich | Talaba aytdi | Sudya gapi | Feedback va bosqich |
|---|---|---|---|
| Rad qilish | «…javobgar vakilidan so'ramoqchiman: obyektdan qancha muddat foydalandingiz?» | «Savollar … dalillarni tekshirish bosqichida beriladi.» ✅ to'g'ri | ❌ `good` «To'g'ri: … rad bildirilmaydi (IPK 20)», bosqich o'tib ketdi |
| Huquqlarni tushuntirish | «…guvohni chaqirishni so'rab iltimosnoma beraman.» | — | ❌ `good` «To'g'ri: … IPK 20», bosqich o'tib ketdi |
| «Iltimosnomalaringiz bormi?» | «…ishni keyinga qoldirishni so'rayman.» | — | ❌ `good` «To'g'ri: huquqlar tushunarli (IPK 165)» |

**Kutilgan natija:**
- bunday harakatda bosqich o'zgarmasin;
- feedback `info` yoki `bad` bo'lsin, masalan: «Bu harakat keyingi bosqichda qilinadi»;
- iltimosnoma bosqichida esa keyinga qoldirish iltimosnomasi ko'rib chiqilsin.

Hozirgi holatda talaba nima desa ham "to'g'ri" deb baholanadi, hisobot buzilib ketadi.

### 4-ish. Feedback sudya gapiga zid

Vakolat bosqichida talaba «Hurmatli sud, javobgar qarzdor.» desa:
- sudya to'g'ri reaksiya qiladi: ishonchnomani qayta so'raydi;
- lekin feedback `info` «Qabul qilindi.» deydi.

Feedback ham «aniqlashtirish so'raldi» bo'lishi kerak.

### 5-ish. Sudya bir xil savolni so'zma-so'z qaytaryapti

Har bir harakatdan (savol, iltimosnoma, keyinga qoldirish, kelishuv) keyin sudya **aynan bir xil** gapni qaytaradi: «Daʼvogar vakili, javobgar obyekt dalolatnoma bilan topshirilmaganini aytmoqda. Bunga munosabatingiz?» Bir sessiyada 5 marta chiqdi va robotdek eshitiladi.

**Taklif:** qaytish uchun 2–3 ta qisqa variant. Masalan:
- «Daʼvogar vakili, savolga qaytamiz: dalolatnoma masalasiga munosabatingiz?»
- «Endi asosiy savolga javob bering: obyekt qanday topshirilgan?»

Variantlarni prerender ham qiling.

### 6-ish. `LEXSIM_REMOTE_KEY`

Kalitsiz sizning ovozingiz faqat sud zalida ishlaydi, chunki u yerda cookie bor. "Ish yo'li" xonalarida va DXM'da talaba brauzer ovozini eshitadi, siz yozib qo'ygan 97 ta gap ishlatilmaydi.

Kalitni loyiha egasiga **shaxsan** bering, chatda emas. U kalitni Netlify'ga va bizning `.env.local` ga qo'yadi. Shundan keyin biz `/nlu/match`, `/store/cases`, `/xapi/statements` va har xonadagi TTS'ni sinab, natijasini yuboramiz.

---

## 5. Ma'lum, kutyapmiz (sizdan hozir hech narsa talab qilinmaydi)

- ayol rollari uchun ayol ovozi namunalari;
- STT `confidence` (hozir `null`; biz `stt` maydonini yubormayapmiz);
- `advanced` darajadagi LLM tezligi (Groq yoki Gemini — server egasining qarori);
- `verifiedAt`: moddalarni mentor tasdiqlashi;
- 2026-11-21 sinov paytida bir marta `POST /sessions` muvaffaqiyatli o'tdi, lekin shu sessiyaga keyingi so'rovlar 502 qaytardi. Xabar bo'sh edi, ehtimol nginx'dan. Bir daqiqadan keyin hammasi tiklandi. Agar o'sha paytda xizmat qayta ishga tushgan bo'lsa, demak kutilgan holat. Sessiyalar qayta ishga tushganda saqlanib qolishini ham tekshirib qo'ying;
- eski `192.168.88.110:8100`: biz to'liq yangi domenga o'tdik, eskisini bizni deb ushlab turish shart emas.

## 6. Tekshirish

```bash
curl -s https://lex-api.e-investment.uz/api/v1/health      # 1.4.0, live-procedure
cd lexsim-web && node tools/qa/live.mjs                     # jonli sud: hozir 7/8, 1–3-ishlardan keyin 8/8 bo'lishi kerak
```
