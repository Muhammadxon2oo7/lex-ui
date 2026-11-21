# LexSim «Bahs» — jamoaviy sud: backend vazifalari

**Kimga:** sud backendi dasturchisiga (`lex-api`, hozir v1.4.6).
**Sana:** 2026-11-21.
**Qisqasi:** frontendda jamoaviy bahs toʻliq ishlaydigan holatda tayyor, lekin xona dvigateli hozir Next.js jarayoni xotirasida turibdi. Netlify (serverless) da bu ishlamaydi. Sizdan uch narsa kerak: **(1) xona dvigatelini backendga koʻchirish, (2) sudya qarorini til modeli bilan chiqarish, (3) sudyaning doimiy gaplarini oldindan ovozlash.** Qolganlari — keyingi bosqich.

---

## 1. Bahs nima

- 2–6 talaba bitta xonaga kod bilan yigʻiladi (5 belgi, masalan `HCXKS`). Hisob yoʻq: ism + xona kodi.
- Ikki jamoa: A va B. Jamoani oʻzlari tanlaydi yoki qurʼa bilan boʻlinadi. Hajm: 1×1, 2×2, 3×3.
- Boshlanganda **tomon** (daʼvogar / javobgar) va **rol** (bosh vakil / ikkinchi vakil / taraf) qurʼa bilan tushadi.
- Tayyor javob yoʻq. Har jamoa ish papkasini va faqat oʻziga tegishli maxfiy faktlarni koʻradi.
- Sudya va kotib — AI. Sudya navbat bilan soʻz beradi, har soʻzning vaqti bor, oxirida gʻolibni aniqlaydi.
- Talaba mikrofonni bosib turib gapiradi (push-to-talk): ovoz STT orqali matnga aylanadi, matn bayonnomaga tushadi, ovoz yozuvi boshqalarga eshittiriladi.

Majlis tartibi (hamma ish uchun bir xil, 14 qadam):

| # | id | Nima | Kim | Vaqt (s) |
|---|---|---|---|---|
| 1 | `open` | Majlis ochilishi | sud | 16 |
| 2 | `claim` | Daʼvo talablari va asoslari | daʼvogar · bosh vakil | 120 |
| 3 | `answer` | Daʼvoga eʼtiroz | javobgar · bosh vakil | 120 |
| 4 | `q1` | Daʼvogar savoli | daʼvogar · ikkinchi vakil | 40 |
| 5 | `a1` | Javobgar javobi | javobgar · taraf | 60 |
| 6 | `q2` | Javobgar savoli | javobgar · ikkinchi vakil | 40 |
| 7 | `a2` | Daʼvogar javobi | daʼvogar · taraf | 60 |
| 8 | `ev1` | Dalillar: daʼvogar | daʼvogar · ikkinchi vakil | 90 |
| 9 | `ev2` | Dalillar: javobgar | javobgar · ikkinchi vakil | 90 |
| 10 | `close1` | Muzokara: daʼvogar | daʼvogar · bosh vakil | 90 |
| 11 | `close2` | Muzokara: javobgar | javobgar · bosh vakil | 90 |
| 12 | `reply1` | Replika: daʼvogar | daʼvogar · bosh vakil | 40 |
| 13 | `reply2` | Replika: javobgar | javobgar · bosh vakil | 40 |
| 14 | `retire` | Sud maslahatxonada | sud | 8 |

Jamoada kerakli rol boʻlmasa (masalan 1×1 da «taraf» yoʻq), soʻz shu jamoaning bosh vakiliga oʻtadi. Har soʻz oldidan sudya gapi uchun +6 s qoʻshiladi.

---

## 2. Hozir frontendda nima bor (namuna sifatida oling)

Hammasi `lexsim-web` reposida, ishlaydi va testdan oʻtgan (2 brauzer bilan toʻliq majlis: 11/11).

| Fayl | Nima |
|---|---|
| `src/contracts/moot.ts` | **Kontrakt (Zod).** Xona, oʻyinchi, qadam, bayonnoma yozuvi, qaror, amallar. Sizning javoblaringiz aynan shu shaklda boʻlsin |
| `src/server/moot/engine.ts` | Xona dvigateli: navbat, taymer, qurʼa, kim nimani koʻradi, aloqadan chiqqanlar. **Koʻchiriladigan mantiq shu** |
| `src/server/moot/judge.ts` | Qoidaga asoslangan dastlabki baho + sizning `/moot/judge` ga murojaat |
| `src/server/moot/cases.ts` | Ish papkasi (hozircha bitta: ijara) |
| `src/app/api/v1/moot/rooms/...` | 6 ta marshrut (pastda) |
| `tools/qa/moot.mjs` | Toʻliq sinov skripti |

---

## 3. 🔴 1-vazifa: xona dvigatelini backendga koʻchirish

**Nega:** xona holati hozir Next.js jarayoni xotirasida. Netlify da har soʻrov boshqa funksiya nusxasiga tushishi mumkin: xona «yoʻqoladi», taymer ishlamaydi, 20 soniyalik kutish (long-poll) uziladi. Bitta doimiy jarayon kerak — u sizda bor.

### 3.1. Marshrutlar

Frontend hozir oʻzining `/api/v1/moot/...` marshrutlarini chaqiradi. Siz xuddi shularni `lex-api` da bering, frontend ularga proksi qiladi (kalit brauzerga chiqmaydi — hozirgi tartib).

| Usul | Yoʻl | Tana | Javob |
|---|---|---|---|
| POST | `/moot/rooms` | `{name, avatar, size, assign}` | `{room}` |
| POST | `/moot/rooms/{code}/join` | `{name, avatar}` | `{room}` |
| GET | `/moot/rooms/{code}?v={version}` | — | `{room}` — **long-poll** |
| POST | `/moot/rooms/{code}/act` | amal (3.3) | `{room}` |
| POST | `/moot/rooms/{code}/audio` | WAV (`audio/wav`) | `{audio: "<id>"}` |
| GET | `/moot/rooms/{code}/audio/{id}` | — | WAV |

- `room` — `MootRoomSchema` (`src/contracts/moot.ts`). **Har oʻyinchiga oʻz koʻrinishi qaytadi** (3.4).
- Oʻyinchi kimligi: frontend har soʻrovda `X-LexSim-Key` va `X-LexSim-Owner: <talabaning tuzlangan xeshi, 32 belgi>` yuboradi — hozirgi `/store/cases` dagi tartibning oʻzi. Oʻyinchi `id` si javobda egadan farq qilsin (boshqalar egani bilib olmasin): masalan `sha256("moot:" + code + ":" + owner)[:12]`. Xonada boʻlmagan egaga — **403 `not_in_room`**; xona yoʻq — **404 `room_not_found`**.
- Xato shakli: `{error: {code, message}}`, `message` oʻzbekcha (talabaga koʻrsatiladi).

### 3.2. Long-poll (yoki WebSocket)

- Har oʻzgarishda `room.version` +1.
- `GET ...?v=N`: agar xona versiyasi `> N` boʻlsa darhol javob; aks holda oʻzgarish boʻlguncha **20 s gacha** kutib, keyin joriy holatni qaytaring.
- Har soʻrov oʻyinchining `seen` vaqtini yangilaydi (onlayn belgisi shu).
- **WebSocket bersangiz yanada yaxshi** (`/moot/rooms/{code}/ws`, har oʻzgarishda oʻsha `room` JSON). Lekin Netlify proksi orqali WS oʻtmaydi: brauzer sizga toʻgʻridan-toʻgʻri ulanishi kerak boʻladi — unda qisqa muddatli xona tokeni (`POST .../join` javobida) va CORS kerak. Birinchi bosqichda long-poll yetarli.

### 3.3. Amallar (`POST .../act`)

| `type` | Maydonlar | Qoida |
|---|---|---|
| `team` | `team: "A"｜"B"｜null` | Faqat lobbida, `assign="pick"` da; jamoa toʻla boʻlsa 409 `team_full` |
| `ready` | `ready: bool` | Lobbi va tanishuvda. Tanishuvda hamma (onlayn) tayyor boʻlsa — majlis darhol boshlanadi |
| `settings` | `size?`, `assign?` | Faqat xona egasi, faqat lobbida |
| `start` | — | Faqat ega; ≥2 kishi; `pick` da har ikki jamoada ≥1 kishi; egadan boshqa hamma tayyor |
| `say` | `text` (1–1200), `audio?` | Faqat soʻz oʻzida boʻlganda, aks holda 409 `not_your_floor`. Bir soʻz ichida bir necha marta mumkin |
| `yield` | — | «Soʻzimni tugatdim» — navbat keyingiga oʻtadi |
| `chat` | `text` (1–400) | Jamoa chati |
| `leave` | — | Lobbida — roʻyxatdan chiqadi; majlisda — «ketgan» deb belgilanadi |

### 3.4. Kim nimani koʻradi — **buzilmasin**

- `case.confidential` va `case.task` — **faqat oʻz tomoniniki**. Raqibning maxfiy faktlari javobda umuman boʻlmasin.
- `chat` — faqat oʻz jamoasiniki.
- `me` — soʻrov egasining oʻzi (`id, team, side, role, host`).
- Sinov: xonaga aʼzo boʻlmagan ega `GET` qilsa — 403.

### 3.5. Soat va yoʻqolganlar (server boshqaradi, brauzer emas)

- `endsAt` (ms) va `now` (server vaqti) javobda. Brauzer faqat ayirmani sanaydi.
- Vaqt tugasa: sudya «Vaqt tugadi. Rahmat.» deydi, navbat oʻtadi. Buni **server taymeri** qiladi (hech kim soʻrov yubormasa ham).
- Tanishuv: 90 s (yoki hamma «tayyor»).
- Soʻzdagi odam 45 s aloqada boʻlmasa — soʻz jamoadoshiga, u ham yoʻq boʻlsa keyingi tomonga oʻtadi (bayonnomaga `system` yozuvi).
- Bir jamoaning hammasi 90 s yoʻq boʻlsa — **texnik magʻlubiyat** (`verdict.forfeit=true`).
- Xona 3 soatdan keyin oʻchadi. Ovoz: bitta klip ≤3 MB, xona boʻyicha ≤80 MB.

### 3.6. Saqlash

- Xona holati qayta ishga tushganda yoʻqolmasin (Redis yoki disk; `/store/cases` dagidek TTL bilan).
- Bir nechta worker boʻlsa, long-poll uygʻotilishi umumiy boʻlsin (Redis pub/sub) — yoki bahs uchun bitta worker.

**Qabul mezoni:** `tools/qa/moot.mjs` sizning marshrutlaringiz bilan 11/11 oʻtadi; server qayta ishga tushirilganda davom etayotgan majlis yoʻqolmaydi.

---

## 4. 🔴 2-vazifa: sudya qarori — `POST /moot/judge`

Hozirgi baho — **qoidaga asoslangan dastlabki baho**: soʻz ishlatildimi, «Hurmatli sud» deyildimi, ish faktlaridagi kalit soʻzlar tilga olindimi. U mazmunni tushunmaydi (kalit soʻzlarni sanab oʻtgan odam yuqori ball oladi). Ekranda ham shunday deb yozilgan. Haqiqiy sudya — sizning til modelingiz.

### Soʻrov (frontend hozirning oʻzida shuni yuboradi)

```json
{
  "case": {"id": "ijara", "title": "...", "claim": "...", "facts": [{"id","title","text"}], "evidence": [{"id","title","text"}],
           "side": {"claimant": {"task": [], "confidential": []}, "respondent": {"task": [], "confidential": []}}},
  "agenda": [{"id": "claim", "title": "...", "side": "claimant", "role": "lead"}],
  "transcript": [{"seq": 4, "by": "<player id>", "name": "Aziza", "side": "claimant", "text": "...", "step": "claim"}],
  "players": [{"id": "...", "name": "...", "side": "claimant"}],
  "rules": {"totals": {"claimant": 90, "respondent": 85}, "criteria": [...]}
}
```

### Javob — `{ "verdict": MootVerdict }`

```json
{"verdict": {
  "winner": "claimant",
  "totals": {"claimant": 78, "respondent": 64},
  "criteria": [{"id": "facts", "label": "Faktlar va dalillar", "max": 30, "claimant": 24, "respondent": 18, "note": "Nega shunday — 1–2 gap"}],
  "ruling": ["Sud taraflarning chiqishlarini eshitdi.", "...", "Bahsda daʼvogar tomoni ustun keldi."],
  "players": [{"id": "...", "name": "...", "side": "claimant", "words": 212, "speeches": 4, "note": "Shaxsiy tavsiya — 1–2 gap"}]
}}
```

`winner: null` — durang. `ruling` ni sudya ovoz bilan oʻqiydi: 3–6 qisqa gap. Frontend `engine: "model"` ni oʻzi qoʻyadi. Shakl mos kelmasa yoki **25 s** ichida javob boʻlmasa — frontend qoida bahosini koʻrsatadi (majlis qarorsiz qolmaydi).

### Talablar

1. **Mezonlar va ogʻirliklar** (yigʻindi 100): soʻzdan foydalanish 20 · sud odobi 15 · faktlar va dalillar 30 · raqibga javob 20 · huquqiy asos 15. `id` lar: `participation, manners, facts, rebuttal, legal`.
2. **Mazmunni baholang:** dalil ish materiallariga mosmi; raqibning aniq gapiga javob berildimi; oʻz zaif joyini qanday yopdi.
3. **Uydirma yoʻq.** Ish materiallarida yoʻq faktga tayangan chiqish uchun ball kamaytiring va `note` da ayting. Model oʻzi ham yangi fakt, summa yoki **modda raqami oʻylab topmasin** — qoidamiz: «manba boʻlmasa, modda yoʻq».
4. **Bu bahs gʻolibi, haqiqiy daʼvo boʻyicha qaror emas.** `ruling` da «daʼvo qanoatlantirilsin» demang; «bahsda … tomoni ustun keldi» deng.
5. Haqorat (sizdagi `profanity` filtri) — shu tomonning `manners` = 0.
6. Barqarorlik: bir xil bayonnoma — bir xil gʻolib (`temperature` past). Farq ≤2 ball boʻlsa — durang.
7. STT xatolarini kechiring: bayonnoma nutqdan olingan, imlo uchun ball kamaytirmang.

---

## 5. 🟠 3-vazifa: sudyaning doimiy gaplari — oldindan ovozlash

Bu gaplar har majlisda bir xil. `elder_m` ovozida oldindan render qilib, keshga qoʻying (`tts-cache` — hozirgi tartib). Aks holda har soʻz oldidan 1–3 s kutiladi.

Kotib (`female`):
- Sud kirib kelmoqda, oʻrningizdan turing!

Sudya (`elder_m`):
- Oʻtiring.
- Soʻz daʼvogar vakiliga beriladi. Daʼvo talablaringiz va ularning asoslarini bayon qiling.
- Soʻz javobgar vakiliga beriladi. Daʼvo talablariga munosabatingizni bildiring.
- Daʼvogar tomoni, javobgarga savolingiz bormi?
- Javobgar tomoni, savolga javob bering.
- Javobgar tomoni, daʼvogarga savolingiz bormi?
- Daʼvogar tomoni, savolga javob bering.
- Dalillarni tekshirishga oʻtamiz. Daʼvogar tomoni, dalillaringizni koʻrsating.
- Javobgar tomoni, dalillaringiz va eʼtirozlaringiz.
- Sud muzokaralariga oʻtiladi. Soʻz daʼvogar vakiliga beriladi.
- Soʻz javobgar vakiliga beriladi.
- Daʼvogar tomoni, replika huquqidan foydalanasizmi?
- Javobgar tomoni, replika huquqidan foydalanasizmi?
- Vaqt tugadi. Rahmat.
- Sud muzokaralari tugadi. Sud qaror qabul qilish uchun maslahatxonaga kiradi.
- Sud taraflarning chiqishlarini eshitdi va baholadi.
- Sud majlisi yopiq deb eʼlon qilinadi.

Ish boʻyicha oʻzgaradigan (har ish uchun bir marta render): «Sud majlisi ochiq deb eʼlon qilinadi. {daʼvogar}ning {javobgar}ga nisbatan daʼvosi koʻrib chiqiladi: {talab}».

Matnlar aynan shunday boʻlsin (kesh matn boʻyicha topiladi). Oʻzgartirsangiz — menga ayting, frontendda ham almashtiraman.

---

## 6. 🟠 4-vazifa: STT navbati

Bahsda bir vaqtda 6 kishigacha gapiradi, har biri 10–40 soniyalik boʻlak yuboradi. Oldingi oʻlchov: STT p50 2,8 s, lekin GPU prerender bilan band boʻlganda p95 ~40 s. Bahsda bu soʻz vaqtini yeb qoʻyadi.

- STT soʻrovlari prerender va TTS dan **ustun** tursin.
- Maqsad: 30 s audio → ≤4 s (p95).
- 60 s gacha boʻlgan boʻlaklarni qabul qiling.

---

## 7. 🟡 5-vazifa: bahs uchun ish papkalari

Hozir bitta ish bor (ijara, sizning ssenariyingizdagi ikki brifingdan olingan). Kamida **5 ta** kerak — mavjud 10 ssenariydan.

`GET /moot/cases` → roʻyxat; `GET /moot/cases/{id}` → toʻliq. Shakl (`src/server/moot/cases.ts` dagi `MootCase`):

```json
{"id": "ijara", "title": "...", "court": "...", "summary": "...",
 "parties": {"claimant": "...", "respondent": "..."}, "claim": "...",
 "facts": [{"id","title","text"}], "evidence": [{"id","title","text"}],
 "side": {"claimant": {"task": ["..."], "confidential": ["..."]}, "respondent": {"task": [], "confidential": []}},
 "points": {"claimant": [["shartnoma","32-p"], ["faktura"]], "respondent": [["dalolatnoma"]]},
 "disclaimer": "Oʻquv ishi..."}
```

Talablar:
- **Muvozanat:** ikki tomonning ham yutish imkoni boʻlsin; har tomonda kamida bitta kuchli va bitta zaif joy.
- Har tomonga 2–4 ta maxfiy fakt.
- **Yurist tekshirgan** boʻlsin; modda raqami faqat manbasi bilan.
- Real ish asosida boʻlsa — nomlar va summalar oʻzgartirilgan.
- `points` — qoida bahosi uchun kalit soʻz guruhlari (til modeli ishlaganda ikkinchi darajali).

Xona ochishda `caseId` yuboriladi (yoki `"random"`).

---

## 8. Keyingi bosqich (hozir shart emas, lekin arxitekturada joy qoldiring)

- **Jonli ovoz (WebRTC, masalan LiveKit).** Hozir ovoz — yozib yuboriladigan boʻlak: gapirib boʻlgach yetib boradi, uzun chiqishda kechikadi. Jonli ovoz buni yechadi; STT oqim bilan ishlaydi.
- **Kuzatuvchi / oʻqituvchi:** xonaga faqat koʻrish huquqi bilan kirish, ikki tomonning ham maxfiy faktlarini koʻrish, majlisni toʻxtatish.
- **Ochiq navbat:** kod yoʻq, «raqib topish» — tizim juftlaydi.
- **Sudyaning jonli aralashuvi:** mavzudan chetga chiqqanda toʻxtatish, aniqlashtiruvchi savol berish (til modeli, ≤2 s javob bilan).
- **Natijalar tarixi va reyting**, oʻqituvchi uchun eksport (xAPI).
- **Yozuvlarni saqlash muddati** — talabalar ovozi shaxsiy maʼlumot: qancha saqlanadi, kim eshita oladi (bu qarorni loyiha egasi beradi).

---

## 9. Mendan sizga savollar

1. Long-poll bilan boshlaymizmi yoki darhol WebSocket? (Netlify sababli men long-pollni taklif qilaman.)
2. `/moot/judge` uchun qaysi model va oʻrtacha javob vaqti? 25 s yetadimi?
3. Xona holati uchun Redis bormi yoki diskda saqlaysizmi?
4. 5 ta ish papkasini yurist bilan qachon tayyorlash mumkin?

## 10. Tayyor boʻlgach menga nima kerak

- Versiya raqami va oʻzgargan marshrutlar roʻyxati.
- `/moot/judge` dan bitta haqiqiy namuna javob.
- Oldindan ovozlangan gaplar keshda ekanini tasdiqlash (matn aynan mosmi).

Shundan keyin frontendni proksiga oʻtkazaman (taxminan yarim kun) va toʻliq sinovni Netlify da yuritaman.
