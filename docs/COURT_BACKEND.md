# LexSim frontend v2 — backend'ni moslashtirish bo'yicha topshiriq

**Kimga:** backend AI dasturchisi va uning agenti.
**Kimdan:** frontend jamoasi.
**Sana:** 2026-11-21.
**Holat:** backend v1 bizga ulandi va real so'rovlar bilan sinovdan o'tdi. Hozir frontend tomonda adapter ishlaydi. Bu hujjatdagi ishlar bajarilgach, adapter "shaffof" bo'ladi: hech narsani o'zgartirmay, faqat uzatadi.

> **Asosiy qoida:** frontend **o'zgarmaydi**. Undagi dizayn, 3D sahnalar, jarayonlar va kontraktlar keyingi bosqichdagi ish natijasi. Backend shu kontraktga moslashadi, aksincha emas. Agar biror talabni bajarib bo'lmasa, uni o'zingiz aylanib o'tmang: savolni bizga yozing (§10).

---

## 0. Qisqacha (TL;DR)

1. Siz `LexSim_Backend_Spec.md` asosida, frontend'ning **start holatiga** moslab yozgansiz. Shundan beri frontend ancha o'zgardi, natijada 3 ta maydon bizning Zod sxemamizdan o'tmaydi (§3.1). Biz buni hozircha adapter bilan yopdik, lekin backend tuzatishi kerak.
2. **P0, demo uchun majburiy (§3):**
   - snapshot'dagi 3 ta maydon;
   - har bir so'zlovchi alohida turn va `role` maydoni bilan;
   - `roomId: "court-economic"`;
   - o'zbek imlosi (ʻ va ʼ);
   - manbalar faqat lex.uz'dan, so'zma-so'z.
3. **P1, sifat (§4):**
   - LLM kutishini bloklamaydigan qilish;
   - hisobotga qarorlar jurnali (debrief) qo'shish;
   - maslahatni baholashda hisobga olish;
   - TTS/STT'ni bizning ovoz kontraktimizga keltirish;
   - zal xoreografiyasi signallari.
4. **P2, keyingi bosqich (§5):** iqtisodiy sud ishini bizning **"Ish yo'li"** protokoliga (`/api/v1/cases`) o'tkazish. Talaba uchun eng to'liq tajriba shu yo'lda.
5. Har bir o'zgarish §8 dagi tekshiruvlardan o'tishi shart: bizning Zod validatori, proxy orqali to'liq oqim va idempotentlik.

---

## 1. Frontend v2 qanday ishlaydi

Agent buni bilmaydi, shuning uchun to'liq yozamiz.

### 1.1. Stack

| Qatlam | Texnologiya |
|---|---|
| Ilova | Next.js 16 (App Router), React 19, TypeScript strict |
| 3D | three.js + React Three Fiber, drei, postprocessing, Rapier |
| Personajlar | Rocketbox avatarlar, mocap animatsiya, Oculus viseme lab-sinxroni, his-tuyg'u (`Emotion`) yuz va gavdada |
| Kontrakt | Zod 4 (`src/contracts/*.ts`). **Har bir javob** Zod'dan o'tadi, o'tmasa UI xato beradi (`contract_violation`) |
| Ovoz | `/api/v1/voice/*` (TTS/STT). Sozlanmagan bo'lsa brauzer nutqi ishlaydi, lab-sinxron baribir bo'ladi |
| Sinov | vitest (31 test), Playwright QA skriptlari (`tools/qa/*.mjs`), z-fighting detektori |

### 1.2. Uchta o'quv dvigateli (bir ilovada)

| Rejim | API | Kim boshqaradi | Holat |
|---|---|---|---|
| **"Ish yo'li"** — bitta ish xonama-xona (maslahat → ariza → devonxona → sudya kabineti → sud majlisi) | `/api/v1/cases` | bizning server (deterministik ish kitobi) | asosiy mahsulot |
| **DXM sessiyasi** — fuqaro bilan suhbat | `/api/v1/sessions` | bizning server | ishlaydi |
| **Iqtisodiy sud (sizning backend)** | `/api/v1/sessions/rmt_*` → sizga | **sizning backend** | ulandi (adapter orqali) |

Sizning backend **sessions** kontrakti orqali ulangan. Shu tufayli mavjud mijoz (`src/game/api.ts`) va hisobot sahifasi (`/simulation/[id]/report`) o'zgarishsiz ishlaydi.

### 1.3. Frontend tamoyillari (backend ham shunday ishlashi kerak)

1. **Server — yagona haqiqat manbai.**
   - Yashirin faktlar, ball va to'g'ri javob talaba "topmaguncha" klientga chiqmaydi.
   - Variantlarning "qiymati" hech qachon oshkor qilinmaydi.
2. **Idempotentlik.**
   - Har bir mutatsiya `clientActionId` yoki `clientTurnId` bilan keladi. Xuddi shu id qayta kelsa, birinchi javob **aynan** qaytariladi.
   - Klient tarmoq uzilsa bir marta qayta yuboradi.
3. **Har bir gap xona holatini olib keladi.** Bizning sahnada kim kirdi, kim turdi va yuz ifodasi gap bilan sinxron o'zgaradi. Sudya eshikdan **yurib kiradi**, hech qachon "paydo bo'lmaydi". Shuning uchun sahna signallari gap bilan birga kelishi kerak (§4.5).
4. **Sud odobi kodda.**
   - Sudga tik turib va «Hurmatli sud!» deb murojaat qilinadi (FPK 212). Iqtisodiy sudda ham xuddi shu tartib: tegishli IPK moddasi lex.uz'dan tasdiqlansin.
   - O'tirib javob berish jarima va ogohlantirish bilan baholanadi.
5. **Pedagogika (INACSL standartlari):**
   - **Prebrief:** bosqich boshida rol, vazifa va baholash mezonlari ko'rsatiladi.
   - **Maslahat:** `M` tugmasi, **−5 ball**, bir lahza uchun bir marta.
   - **Debrief (tahlil):** har bir qaror uchun nima so'ralgan, nima tanlangan, ball, sabab, **yaxshiroq javob** va modda ko'rsatiladi.
   - **Mulohaza savoli.**
   - **xAPI hisobot (JSON eksport).**
6. **"Manba bo'lmasa, modda yo'q".**
   - Har bir modda raqami lex.uz'dan **so'zma-so'z** olingan matnga tayanadi. Matnda tahrir sanasi va olingan sana bo'ladi.
   - O'ylab topilgan yoki tekshirilmagan modda UI'da ko'rsatilmaydi.
7. **O'zbek imlosi — rasmiy belgilar.**
   - **oʻ / gʻ** uchun `ʻ` (U+02BB), tutuq belgisi uchun `ʼ` (U+02BC) ishlatiladi. lex.uz ham shunday yozadi.
   - Oddiy `'` va `’` matnda bo'lmasin.
   - Kiruvchi matnni (talaba yozgani) biz o'zimiz normallashtiramiz.
8. **O'zbekiston reallari:**
   - Sud nomi rasmiy tartibda yoziladi: «Fuqarolik ishlari boʻyicha Namuna tumanlararo sudi», «Namuna tumanlararo iqtisodiy sudi».
   - Davlat ramzlari faqat rasmiy tasvirdan olinadi.
   - Hujjatlar «OʻQUV NAMUNASI» belgisi bilan chiqadi.
   - Haqiqiy tashkilot nomi ishlatilmaydi.
9. **Maxfiylik.**
   - Ism-familiya, pasport yoki PINFL serverga yuborilmaydi.
   - Ovoz yozuvi saqlanmaydi.
   - xAPI aktyori anonim.
10. **Ishonchlilik.**
    - Har bir tashqi so'rovda timeout bor.
    - Xato bo'lsa, foydalanuvchiga o'zbekcha aniq xabar chiqadi, sahna qotib qolmaydi.

---

## 2. Hozirgi integratsiya — frontend tomonda nima qilindi

**Fayllar:**
- `lexsim-web/src/server/remote/court.ts` — adapter;
- `lexsim-web/src/app/api/v1/sessions/**/route.ts` — `rmt_` bo'yicha delegatsiya;
- `lexsim-web/src/app/api/v1/sessions/[id]/hint/route.ts` — maslahat;
- `lexsim-web/src/app/api/v1/remote/route.ts` — holat;
- `lexsim-web/src/game/api.ts` — `hint()`, `remoteStatus()` va turn timeout'i 190 s.

**Sozlash:** `.env.local` → `LEXSIM_REMOTE_URL=http://192.168.88.110:8100/api/v1`. O'rnatilmasa, iqtisodiy sud ishi yashiriladi va boshqa hech narsa o'zgarmaydi.

**Oqim:**

```
Brauzer ──/api/v1/sessions/rmt_<id>/...──▶ Next server (adapter) ──/api/v1/sessions/<id>/...──▶ Sizning backend
         ◀── bizning kontrakt (Zod OK) ────                       ◀── sizning javob ─────────────
```

**Adapter nima qiladi (backend tuzatgach, 1–5-bandlar keraksiz bo'ladi):**

1. `sessionId` ga `rmt_` prefiksini qo'shadi va uni olib tashlaydi.
2. `scenario.durationMinutes` ni songa emas, **satrga** aylantiradi.
3. `scenario.briefing` matnini obyektga aylantiradi: `{workplace, position, authority[], task[]}`. «Maxfiy:» qismi `authority` ga tushadi.
4. `options` maydoni bo'lmasa, `[]` qo'yadi.
5. Kontraktda yo'q event turlarini **tashlab yuboradi** (yiqilmaydi).
6. Sizning `lexsim_owner` cookie'ingizni server tomonda saqlaydi: brauzerda bizning o'z cookie'imiz bor, nomlar to'qnashmaydi.
7. Timeout'lar:
   - turn — 180 s;
   - finish — 60 s;
   - qolganlari — 20 s.

   Timeout bo'lsa `504 remote_timeout`, aloqa bo'lmasa `503 remote_unavailable`.
8. Snapshot, mutatsiya, hisobot va maslahat bizning Zod'dan o'tkaziladi. O'tmasa `502 remote_contract` qaytadi va logda qaysi maydon o'tmagani yoziladi.

**2026-11-21 dagi real sinov natijalari (proxy orqali):**

| Qadam | Natija |
|---|---|
| `POST /sessions {sud-ijara-javobgar}` | 200, 74 ms, **Zod OK** |
| `interactions start`, `sit-at-desk` | 200, ~30 ms, Zod OK |
| `GET /hint` | 200, 490 ms, Zod OK |
| `POST /turns` (protsedura gapi) | 200, 461 ms, Zod OK |
| Boshqa cookie bilan `GET` | **403 forbidden** — egalik tekshiruvi ishlaydi |

**Adaptersiz** (to'g'ridan-to'g'ri) har bir snapshot 3 joyda xato berardi: `durationMinutes`, `briefing` va `options`.

> **Muhim:** hujjatingizdagi `rewrites: /api/v1/:path* → backend` tavsiyasini **qo'llamang**. U bizning o'z route'larimizni yopib qo'yadi: `/cases`, `/hearings`, `/voice`, lokal `/sessions`. Integratsiya faqat yuqoridagi adapter orqali.

---

## 3. P0 — backend'dagi majburiy o'zgarishlar (demo oldidan)

### 3.1. Snapshot'ni bizning `SnapshotSchema` ga keltirish

To'liq sxema §11.1 da. Farqlar:

| Maydon | Hozir (sizda) | Kerak (bizda) | Misol |
|---|---|---|---|
| `scenario.durationMinutes` | `25` (number) | **string** | `"25"` |
| `scenario.briefing` | bitta matn | **obyekt** | §3.1.1 |
| `options` | yo'q | **har doim** `ReplyOption[]` (erkin matnli rejimda `[]`) | `[]` |

#### 3.1.1. `briefing` tuzilishi

```json
{
  "workplace": "Namuna tumanlararo iqtisodiy sudi · 2-sud majlislari zali",
  "position": "Javobgar vakili (yakka tartibdagi tadbirkor «B»)",
  "authority": [
    "Ishonchnoma: 2026-yil 10-noyabr, № 14",
    "Maxfiy (faqat siz bilasiz): mijoz joydan taxminan uch oy foydalangan; topshirish dalolatnomasi imzolanmagan."
  ],
  "task": [
    "«A» MChJ 32-P-sonli ijara shartnomasi boʻyicha 25 620 433,19 soʻm qarz va 3 040 580,45 soʻm penya undirishni soʻragan.",
    "Mijoz manfaatini himoya qiling; sudga «Hurmatli sud!» deb tik turib murojaat qiling."
  ]
}
```

- **`workplace`** — UI sarlavhasida chiqadi: sud va zal nomi rasmiy tartibda.
- **`position`** — talabaning roli.
- **`authority`** — vakolat va maxfiy ma'lumot: talabaning o'z mijozidan bilgani.
- **`task`** — vazifa bandlari, 2–4 ta qisqa gap.

### 3.2. Har bir so'zlovchi — alohida turn, rol bilan

**Hozir:** bitta `npc` turn ichida bir necha kishi gapiradi va kim gapirayotgani prefiks bilan belgilanadi:

```
"Kotib: Sud kirib kelmoqda, o'rningizdan turing!\nSud majlisi ochiq deb e'lon qilinadi. …"
```

Bizning sahnada har bir so'zlovchining o'z joyi, yuzi, ovozi va lab-sinxroni bor. Shuning uchun:

1. **Bitta turn = bitta so'zlovchi = bitta gap bloki.** Kotib va sudya ikkita alohida turn bo'ladi.
2. Matn boshidagi `"Kotib: "`, `"Da'vogar vakili: "` kabi prefikslar **olib tashlansin**.
3. Turn'ga quyidagi maydonlar qo'shilsin. Ular qo'shimcha, ya'ni bizning eski sxemamiz ularni e'tiborsiz qoldiradi; biz ularni qo'shib, qo'llay boshlaymiz:

```ts
// Turn (§11.1) + qo'shimcha maydonlar
{
  id: string; index: number; speaker: 'user' | 'npc' | 'system'; text: string; at: string;
  emotion?: Emotion;                          // mavjud enum, §11.1
  role?: 'judge' | 'secretary' | 'opponent' | 'witness' | 'expert';   // YANGI: npc kim
  scene?: Partial<CourtScene>;                // YANGI: §4.5
}
```

4. `emotion` **har bir npc turn'da** bo'lsin. Bu enum bizda yuz ifodasini boshqaradi.

### 3.3. `roomId`

`"dxm-centre-01"` o'rniga **`"court-economic"`** yozilsin. Biz bu ishni o'zimizning 3D sud zalimizda ko'rsatamiz, DXM ofisida emas. Zal belgisi «… tumanlararo iqtisodiy sudi» bo'ladi.

### 3.4. O'zbek imlosi

Hozirgi matnlarda oddiy apostrof bor, masalan: `o'rningizdan`, `Da'vogar`, `bo'yicha`. Talab:

| Joy | To'g'ri |
|---|---|
| oʻ, gʻ | `ʻ` U+02BB → `oʻrningizdan`, `boʻyicha`, `gʻ` |
| tutuq belgisi | `ʼ` U+02BC → `daʼvogar`, `eʼlon`, `maʼlumot` |
| qisqartmaga qo'shimcha | apostrofsiz → «lex.uz saytidan», «DXMda» |

Bu qoida sudya, kotib va raqib shablonlari, LLM chiqishi, hisobot, `hint` va `briefing` — hamma joyga tegishli. LLM chiqishini javob berishdan oldin normallashtiring:

```python
import re
def uz_norm(s: str) -> str:
    s = re.sub(r"(?<=[OoGg])['’‘`ʼ]", "ʻ", s)     # oʻ gʻ
    s = re.sub(r"(?<=\w)['’`](?=\w)", "ʼ", s)     # tutuq
    return s
```

Imlo xatosi ham bo'lmasin. LLM chiqishini oxirgi bosqichda tekshiring.

### 3.5. Huquqiy manbalar

1. Har bir `Source`da quyidagilar bo'lsin:
   - `officialUrl` faqat `https://lex.uz/...` (bizning UI boshqa hostni "rasmiy manba" sifatida ko'rsatmaydi);
   - `articleNumber`;
   - `effectiveAt` — tahrir sanasi.
2. `verifiedAt: null` bo'lsa, biz uni «mentor tasdiqlamagan» deb ko'rsatamiz. Ssenariydagi asosiy moddalarni mentor tasdiqlasin va `verifiedAt` to'ldirilsin.
3. **Tekshirilishi kerak:** brifing va "yaxshi javoblar"dagi **FK 578-modda** (topshirish dalolatnomasi) va **FK 326-modda** (penyani kamaytirish). Biz ularni lex.uz'dan so'zma-so'z tasdiqlay olmadik. RAG bazangizdan aniq matn va URL bilan tasdiqlang. Tasdiqlanmasa, raqamni olib tashlang.
4. Iqtisodiy sud protsessi **IPK** (Iqtisodiy protsessual kodeksi) bo'yicha ketadi. Sudya shablonlaridagi har bir protsessual qadamga IPK moddasini bog'lang:
   - sud tarkibini e'lon qilish;
   - rad qilish;
   - huquqlarni tushuntirish;
   - iltimosnomalar;
   - dalillarni tekshirish;
   - muzokaralar;
   - hal qiluv qarori, tahrir sanasi bilan.

   Bu bizning "har qadam moddaga bog'langan" tamoyilimiz.
5. LLM javobidagi har bir modda raqami RAG'dan tasdiqlanadi. Yangi raqam o'ylab topilsa, javob rad etiladi; buni allaqachon qilyapsiz.

---

## 4. P1 — sifat va UX'ga moslash

### 4.1. LLM kutishi (60–90 s) — bloklamaydigan qilish

**Hozir:** `POST /turns` 60–90 s ochiq turadi. Proxy va mobil tarmoqlar uchun bu xavfli. 1–2 dan ko'p foydalanuvchida navbat cho'ziladi.

**Talab (birini tanlang):**

- **A. Async turn (tavsiya).**
  1. `POST /turns` darhol `202` qaytaradi: `events: [dialogue.userTurn, session.status{status:"in-progress"}]` va snapshot'da `pending: true`.
  2. Raqib javobi tayyor bo'lganda `GET /sessions/{id}/events?after=N` uni `dialogue.npcTurn` sifatida beradi.
  3. Biz 1,5 s oraliqda so'raymiz va «Raqib advokat javob tayyorlamoqda…» holatini ko'rsatamiz.
- **B. Server-Sent Events.** `GET /sessions/{id}/stream` — `text/event-stream`. Har bir event bizning `SimEvent` shaklida.

**Maqsadli vaqtlar:**
- protsedura javobi — < 300 ms;
- RAG — < 3 s;
- raqib (LLM) — < 15 s. Model tezlashtirilsin: kichikroq kvantlash yoki tezroq model.

15 s'dan oshsa, shablon gap qaytarilsin va `engine` buni rost ko'rsatsin.

**Demo rejimi:** `LEXSIM_LLM=0` bo'lsa hammasi shablon bilan ishlaydi va snapshot'da `engine: "scripted"` bo'ladi. Hakamlar oldida LLM sekin bo'lsa, shu rejim ishlatiladi.

### 4.2. Hisobot → bizning debrief formatiga

Bizning UI har bir bosqichdan keyin **tahlil** (debrief) ko'rsatadi. `Assessment` (§11.3) o'zgarmaydi, unga qo'shimcha maydon kerak:

```ts
decisions: Array<{
  at: number;              // sessiya boshidan soniya
  prompt: string | null;   // sudya yoki raqib nima deganiga javob edi
  chose: string;           // talaba nima dedi (o'z so'zi bilan)
  tone: 'good' | 'bad' | 'info' | null;
  points: number;          // shu gap uchun ayirilgan ball (0 bo'lsa yo'q)
  why: string | null;      // nega xato: qisqa, o'zbekcha
  better: string | null;   // yaxshiroq javob namunasi
  article: string | null;  // "IPK 154-modda" kabi, faqat tasdiqlangan
}>;
hints: number;             // ishlatilgan maslahatlar soni
reflect: string | null;    // mulohaza savoli
```

- `betterAnswer` saqlansin. `decisions` uni har bir xato uchun kengaytiradi.
- **Baholash.** Hozir kalit so'zlar bo'yicha baholaysiz va to'g'ri fikrni boshqa so'z bilan aytgan talaba past ball oladi. Tavsiya: har bir bosqich uchun **mezon ro'yxati** va semantik moslik — embedding'lar bge-m3'da allaqachon bor, ostona ≥ 0,78. Kalit so'z yordamchi signal bo'lib qolsin.
- **Axloq.** Pora, bosim yoki yolg'on ko'rsatuvga undash bo'lsa, `zeroedByEthics: true` va ball 0.

### 4.3. Maslahat (`/hint`) — bizning qoidaga

- `hint` olinganda shu bosqich uchun **−5 ball** hisoblansin. Bir bosqich uchun faqat bir marta.
- `report.hints` va `decisions` da shu ko'rinsin.
- `assessment` rejimida `409 hints_disabled` qolsin, bu to'g'ri.
- `sources` lex.uz bo'yicha, §3.5 qoidasida.

### 4.4. Ovoz: TTS va STT — bizning kontraktga

Biz Azure kalitisiz ishlayapmiz. Sizning TTS (7008) o'zbek ovozini bersa, bu katta yutuq. Hozir 7008 portida **login so'raydigan Gradio ilovasi** turibdi, API hujjati yo'q. Talab: backend'da (8100) bizning shakldagi endpoint'lar bo'lsin. Biz o'z route'imizni sizga yo'naltiramiz.

```
POST /api/v1/voice/tts
  Content-Type: application/json
  { "text": "…", "voice": "elder_m" | "male" | "female" | "female_alt" }   // text ≤ 600 belgi
  → 200 audio/mpeg (mp3, 24 kHz mono), Cache-Control: private, max-age=86400
  → 404 {error:{code:"voice_unavailable"}} | 502 {error:{code:"voice_failed"}}

POST /api/v1/voice/stt
  Content-Type: audio/wav   (16 kHz, mono, PCM16, ≤ 1,2 MB ≈ 37 s)
  → 200 { "text": "…" }     (o'zbek lotin, ʻ/ʼ bilan)

GET /api/v1/voice/status → { "tts": "server" | null, "stt": "server" | null }
```

**Ovozlar:**

| Ovoz | Kim | Qanday |
|---|---|---|
| `elder_m` | sudya | past, sokin erkak ovozi, biroz sekin |
| `male` | erkak taraf yoki guvoh | odatiy erkak ovozi |
| `female` | kotib | aniq ayol ovozi |
| `female_alt` | raqib vakili (ayol) | ayol ovozi, ohangi biroz baland |

**Talablar:**
- birinchi bayt kelishi (TTFB) < 1,5 s;
- bir xil matn keshlansin;
- audio **saqlanmasin** (maxfiylik);
- STT mikrofon yozuvini diskka yozmasin.

**Muhim:** bizning lab-sinxron ovoz davomiyligiga moslashadi, shuning uchun mp3 `Content-Length` to'g'ri bo'lsin.

### 4.5. Zal xoreografiyasi (sahna signallari)

Bizning sud zalida sudya xizmat eshigidan yurib kiradi, hamma o'rnidan turadi va o'tiradi, guvoh yo'lakdan keladi. Buning uchun npc turn'da `scene` kelishi kerak. Bu qisman yangilanish, faqat o'zgargan maydonlar:

```ts
type CourtScene = {
  judgeIn: boolean;        // sudya zalda
  everyoneStands: boolean; // "Sud kirib kelmoqda!" → true, "O'tiring" → false
  witnessIn: boolean;      // guvoh zalga chaqirildi
};
```

**Misol:**
1. Kotibning «Sud kirib kelmoqda, oʻrningizdan turing!» turni: `scene: {everyoneStands: true}`.
2. Keyingi sistem gapi «Sudya zalga kirdi.»: `scene: {judgeIn: true}`.
3. Sudyaning «Oʻtiring.» gapi: `scene: {everyoneStands: false}`.

**Talabaning turishi.** Bizda talaba `G` tugmasi bilan turadi. Talaba tik turmasdan gapirgan bo'lsa, buni bilish kerak. Biz `InteractionRequest.action` ga `"stand"` va `"sit"` qo'shamiz; siz ularni qabul qilib, «oʻtirib javob berish» qoidasini baholashda qo'llaysiz (§10, 3-savol).

---

## 5. P2 — chuqur integratsiya: "Ish yo'li" protokoli (`/api/v1/cases`)

Talaba uchun eng to'liq tajriba shu yo'lda: xonama-xona ish, ariza tuzish, devonxona va sud majlisi. Mehnat (FPK) va o'g'irlik (JPK) ishlari shu protokolda ishlaydi. Iqtisodiy ijara ishini ham shunga o'tkazish taklif qilinadi:

- `kind: "lease"`;
- bosqichlar: `l-consult` → `l-claim` → `l-filing` → `l-hearing`.

**Protokol:**

```
POST /api/v1/cases                 {fresh: boolean, kind: "lease"}         → {case: CaseSnapshot}
GET  /api/v1/cases/current?kind=lease                                      → {case} | 404
GET  /api/v1/cases/{id}                                                    → {case}
POST /api/v1/cases/{id}/act        CaseActRequest (§11.4)                  → {case}
```

**Semantika** (to'liq sxema §11.4):

- **`stages[]`** — ish xonalari. Talaba **istalgan xonadan** boshlay oladi; avvalgi bosqichlar «tayyor ish papkasi» bilan to'ldiriladi (`PREPARED`). Bu bizning asosiy UX talabimiz.
- **`lines[]`** — har bir gap: `speaker`, `text`, `emotion`, `scene` (o'sha lahzadagi to'liq xona holati).
- **`options[]`** — ekranda bir vaqtda **ko'pi bilan 4 ta**:
  - **3 ta foydali** variant;
  - **1 ta ishonarli xato** variant (masalan, «Yoʻq.» emas, real xato).
- **`await`** — `stand` | `sit` | `draft`: xona javobdan boshqa narsani kutyapti (turish, o'tirish, ariza tuzish).
- **`feedback`** — har tanlovdan keyin `good`/`bad`/`info` va modda. Xato bo'lsa `bad` va sababi.
- **`result`** — bosqich oxirida chiqadi:
  - `score`, `verdict`;
  - `log` (qarorlar jurnali);
  - `hints`, `reflect`.
- **`act`** turlari:
  - `enter`, `choose`;
  - `stand` — sud zalida tik turib javob berish majburiy;
  - `draft`, `hint` (−5 ball), `leave`.
- **`code`** — shu ishda keltirilgan moddalar. Matn lex.uz'dan so'zma-so'z, `edition` va `retrievedAt` bilan, `url` lex.uz.
- **Gibrid rejim.** Erkin matnli javob bilan birga kelishi mumkin: `CaseActRequest` ga `{type:"say", text}` qo'shiladi. Variantdan tashqari gap aytilsa, uni LLM va RAG baholaydi. Biz sxemaga qo'shamiz.

**Mavjud namunalar (o'qib chiqing):**
- `lexsim-web/src/server/case/ishga-tiklash.ts` — mehnat ishi kitobi: tugunlar, variantlar, jarimalar, moddalar, sahna xoreografiyasi;
- `lexsim-web/src/server/case/ogirlik.ts` — JPK;
- `lexsim-web/src/server/case/engine.ts` — dvigatel: debrief jurnali, maslahat, «tik turib gapirish» qoidasi, tayyor papka.

Shu tuzilmani iqtisodiy ish uchun Python'da takrorlang. LLM va RAG'ingiz erkin javob va raqib nutqi uchun qo'shimcha qatlam bo'ladi.

---

## 6. Iqtisodiy ish — kontent va huquqiy talablar

1. **Sud nomi.** «Namuna tumanlararo iqtisodiy sudi». Shablonlarda real sud nomi bo'lmasin.
2. **Taraflar:** «A» MChJ va YTT «B». Real ish asosida bo'lsa, «sezilarli oʻzgartirilgan» degan izoh qolsin; buni qilyapsiz.
3. **Protsess tartibi.** IPK bo'yicha tekshirilsin:
   - sud tarkibini e'lon qilish;
   - rad qilish;
   - huquqlarni tushuntirish;
   - iltimosnomalar;
   - tushuntirishlar;
   - yozma dalillarni o'qib eshittirish;
   - muzokaralar;
   - hal qiluv qarori **«Oʻzbekiston Respublikasi nomidan»**.
   - Qarorda shikoyat muddati aytiladi.

   Har bir qadam tegishli IPK moddasiga bog'lansin.
4. **Penya.** FK bo'yicha penyani kamaytirish asosi (FK 326 — tasdiqlang) va «nomutanosiblik»ni isbotlash yuki kimda ekani hisobotda to'g'ri yozilsin.
5. **Hisobotdagi `mentor-review`** — «Haqiqiy sud qanday hal qilgan». Bu matn real ishning **anonimlashtirilgan** xulosasi bo'lsin; ish raqami yoki ismlar bo'lmasin.

---

## 7. Xavfsizlik va infratuzilma

1. **Kirish ma'lumotlari.** SSH paroli suhbatda ochiq yuborilgan — **almashtiring**. Kalit bilan kirishga o'ting, parol bilan kirishni o'chiring.
2. **Tarmoq.** Server faqat lokal tarmoqda (`192.168.88.110`, HTTP). Hakaton joyi boshqa tarmoqda bo'lsa, integratsiya ishlamaydi. Variantlar:
   - (a) backend demo noutbukda lokal ishga tushiriladi;
   - (b) WireGuard/Tailscale orqali yopiq tunnel.

   Ochiq internetga chiqarmang; bu sizning ham qoidangiz.
3. **HTTPS.** HTTPS'ga o'tganda `LEXSIM_SECURE_COOKIE=1`. Cookie `HttpOnly; SameSite=Lax; Path=/`.
4. **Rate limit.** Har bir owner uchun turn — 30/min, create — 20/min (bizdagidek). LLM navbati to'lganda `429 rate_limited` va o'zbekcha xabar.
5. **Kontrakt versiyasi.** `snapshot.protocol` = `1` bo'lib qolsin. Buzuvchi o'zgarish bo'lsa `2` qiling va bizga oldindan yozing.
6. **Persistence.** SQLite'da saqlash juda yaxshi, shunday qolsin. Bizning case dvigatelimiz xotirada saqlaydi; §5 dagi `/cases` ni ham SQLite'da saqlang.
7. **Health.** `/health` da `llm.last_ms`, `rag_db`, `queue_depth` (yangi) va `version` bo'lsin. Biz hub'da «Sud serveri: ulangan · LLM ~12 s» deb ko'rsatamiz.

---

## 8. Qabul mezonlari — tayyor degani nima

Har bir PR shu ro'yxatdan o'tadi.

### 8.1. Kontrakt (bizning Zod bilan)

`lexsim-web` papkasida turib quyidagi skriptni ishga tushiring: `node_modules/.bin/jiti check.ts`. Hammasi `Zod OK` chiqishi shart.

```ts
// check.ts — to'g'ridan-to'g'ri backend'ga (adaptersiz) tekshiruv
import { SnapshotSchema, MutationResponseSchema, AssessmentSchema, HintSchema } from './src/contracts/index.ts';
const B = 'http://192.168.88.110:8100/api/v1';
let cookie = '';
const call = async (p: string, body?: unknown) => {
  const r = await fetch(B + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const c = r.headers.get('set-cookie'); if (c) cookie = c.split(';')[0];
  return r.json();
};
const ok = (n: string, r: any) => console.log(n, r.success ? 'Zod OK' : JSON.stringify(r.error.issues.slice(0, 5)));
const s = await call('/sessions', { scenarioId: 'sud-ijara-javobgar', mode: 'tutorial' }); ok('create', SnapshotSchema.safeParse(s.snapshot));
const id = s.snapshot.sessionId;
ok('start', MutationResponseSchema.safeParse(await call(`/sessions/${id}/interactions`, { action: 'start', clientActionId: 'chk-start-0001' })));
ok('sit', MutationResponseSchema.safeParse(await call(`/sessions/${id}/interactions`, { action: 'sit-at-desk', clientActionId: 'chk-sit-00001' })));
ok('hint', HintSchema.safeParse((await call(`/sessions/${id}/hint`)).hint));
ok('turn', MutationResponseSchema.safeParse(await call(`/sessions/${id}/turns`, { text: 'Hurmatli sud, javobgar vakiliman, ishonchnomamni taqdim etaman.', clientTurnId: 'chk-turn-00001' })));
// … to'liq oqim, finish, keyin:
// ok('report', AssessmentSchema.safeParse((await call(`/sessions/${id}/report`)).report));
```

### 8.2. Funksional tekshiruvlar

- [ ] §3.1 — 3 ta maydon to'g'ri. Adaptersiz `Zod OK`.
- [ ] §3.2 — bitta turn = bitta so'zlovchi. `role` va `emotion` har bir npc turn'da bor, prefiks yo'q.
- [ ] §3.3 — `roomId: "court-economic"`.
- [ ] §3.4 — barcha chiquvchi matnda `'`, `’`, `‘` yo'q. Avtomatik test: snapshot matnlarida `/[A-Za-z]['’‘][A-Za-z]/` topilmaydi.
- [ ] §3.5 — har bir `Source.officialUrl` `lex.uz` da. FK 326/578 tasdiqlangan yoki olib tashlangan.
- [ ] Idempotentlik: bir xil `clientTurnId` bilan 3 marta yuborilsa, javob bir xil, `sequence` o'zgarmaydi.
- [ ] Egalik: boshqa cookie bilan `403 forbidden`.
- [ ] `events?after=N` uzluksiz `sequence` beradi.
- [ ] §4.1 — LLM'li turn klientni 15 s'dan ortiq bloklamaydi (async yoki SSE).
- [ ] §4.2 — `report.decisions` bor, har bir xato uchun `better` va tasdiqlangan `article` bor.
- [ ] §4.3 — maslahat −5 ball va `report.hints` da ko'rinadi.
- [ ] §4.4 — `/voice/tts` mp3 qaytaradi (4 ta ovoz), `/voice/stt` o'zbekcha matn qaytaradi.
- [ ] Ikkala rol bo'yicha "yaxshi" va "yomon" yo'llar bilan to'liq oqim. Natija `A'lo` va `poor` chiqadi, hisobotdagi sabablar mantiqli.

### 8.3. Proxy orqali (bizning tomonda)

```bash
# frontend dev serverida
curl -s http://localhost:3000/api/v1/remote          # {enabled:true, ok:true, scenarios:[…]}
```

Bizning Playwright QA'miz to'liq oqimni brauzerda o'ynaydi. Natijani sizga yuboramiz.

---

## 9. Ish tartibi

1. Har bir § uchun alohida PR yoki commit, P0 → P1 → P2 tartibida.
2. Har bir o'zgarishdan keyin §8.1 skripti va `tools/backend_sinov.py` ishga tushiriladi, natija log bilan yuboriladi.
3. Kontraktni buzuvchi har qanday o'zgarish oldin bizga yoziladi (`protocol` versiyasi bilan).
4. Shablon va LLM gaplarining yangi to'plami bizga ko'rib chiqish uchun yuboriladi: imlo, odob va moddalar.

---

## 10. Ochiq savollar (javob bering)

1. TTS (7008) qaysi model? O'zbek ovozlari soni nechta, erkak/ayol, va 1 gap uchun kechikish qancha? (§4.4)
2. Qwen javobini 15 s'gacha tushirish mumkinmi: kichikroq model yoki kvantlash? Yoki demo uchun `LEXSIM_LLM=0` qilamizmi? (§4.1)
3. `stand`/`sit` harakatlarini qabul qilasizmi? (§4.5) Biz `InteractionRequest` ga qo'shamiz.
4. §5 ("Ish yo'li" protokoli) ni qachon boshlaysiz? Bir bosqichli prototip uchun bizga `l-hearing` yetarli.
5. Hakaton joyida server qanday ishlaydi (§7.2)?

---

## 11. Ilova: aniq sxemalar (manba: `lexsim-web/src/contracts/`)

Bu sxemalar Zod'da `z.object`, ya'ni **qo'shimcha maydonlar tashlab yuboriladi**: qo'shish xavfsiz, o'chirish yoki tur o'zgartirish esa buzadi.

### 11.1. Sessiya: `Snapshot`, `Turn`, enum'lar

```ts
Emotion = 'neutral' | 'impatient' | 'upset' | 'confused' | 'uncertain' | 'calm' | 'reassured'
Gesture = 'none' | 'nod' | 'shake-head' | 'sigh' | 'lean-in' | 'check-watch' | 'show-phone' | 'offer-envelope' | 'withdraw-envelope' | 'stand'
SessionStatus = 'briefing' | 'in-progress' | 'evaluating' | 'report-ready' | 'aborted'
SessionMode = 'tutorial' | 'assessment'

Turn = { id: string(min 1); index: int ≥ 0; speaker: 'user' | 'npc' | 'system'; text: string; at: string(ISO); emotion?: Emotion }
Fact = { id: string; text: string; unlockedAtTurn: int }
Objective = { id: string; label: string; done: boolean }
ReplyOption = { id: string; text: string; kind: 'ask' | 'explain' | 'react' }

ScenarioPublic = {
  id: string; title: string; role: string; level: string;
  durationMinutes: string;                 // ← satr
  roomId: string;                          // ← "court-economic"
  briefing: { workplace: string; position: string; authority: string[]; task: string[] };   // ← obyekt
  npc: { id: string; name: string; age: int };
  disclaimer: string;
}

Snapshot = {
  protocol: 1;
  sessionId: string; sequence: int ≥ 0; status: SessionStatus; mode: SessionMode;
  engine: 'scripted' | 'llm';
  scenario: ScenarioPublic;
  meters: { patience: number; trust: number } | null;
  npc: { emotion: Emotion; intensity: number(0..1) };
  turns: Turn[];
  options: ReplyOption[];                  // ← har doim massiv
  facts: Fact[]; factsTotal: int;
  objectives: Objective[];
  objects: Record<string, 'active' | 'disabled' | 'open' | 'closed'>;
  document: DocumentDraft; documentSubmitted: boolean;
  outcome: { id: 'excellent' | 'average' | 'poor' | 'failed'; title: string; description: string } | null;
  startedAt: string | null;
}
```

### 11.2. Event'lar va so'rovlar

```ts
eventBase = { eventId: string(min 1); sequence: int ≥ 0; sessionId: string(min 1); timestamp: string }
SimEvent =
  | { type: 'dialogue.userTurn';  payload: { turn: Turn } }
  | { type: 'dialogue.npcTurn';   payload: { turn: Turn } }
  | { type: 'npc.emotion';        payload: { npcId: string; emotion: Emotion; intensity: number } }
  | { type: 'npc.gesture';        payload: { npcId: string; clip: Gesture } }
  | { type: 'scene.objectState';  payload: { objectId: string; state: ObjectState } }
  | { type: 'objective.updated';  payload: { objectiveId: string; done: boolean } }
  | { type: 'session.status';     payload: { status: SessionStatus } }
MutationResponse = { events: SimEvent[]; snapshot: Snapshot }

CreateSessionRequest = { scenarioId: string; mode?: SessionMode = 'tutorial'; seed?: int }
TurnRequest = { clientTurnId: string(8..64); optionId?: string; text?: string(1..800) }   // aniq bittasi
InteractionRequest = { clientActionId: string(8..64); action: 'start' | 'enter-room' | 'sit-at-desk' | 'open-terminal' | 'inspect-phone' }
FinishRequest = { clientActionId: string(8..64) }
Error = { error: { code: string; message: string(o'zbekcha, foydalanuvchiga ko'rsatiladi) } }
```

### 11.3. Hisobot va maslahat

```ts
Source = { title: string; officialUrl: url; articleNumber?: string; effectiveAt?: string; verifiedAt: string | null }
Assessment = {
  sessionId; scenarioId; rubricVersion: string;
  scoreTotal: int(0..100); zeroedByEthics: boolean;
  outcome: { id; title; description };
  criteria: { id: 'legal'|'facts'|'procedure'|'communication'|'ethics'|'document'; label; score ≥ 0; max > 0; explanation; supportingTurnIds: string[] }[];
  feedback: { kind: 'strength'|'error'|'mentor-review'; title; message; quote?; relatedTurnIds: string[]; sources: Source[] }[];
  betterAnswer: { original; improved; why } | null;
  idealPath: { step; done }[];
  nextScenario: { id; title; reason };
  reviewStatus: 'auto' | 'needs-mentor' | 'mentor-approved';
  appeal: { at; reason } | null;
  turns: Turn[]; facts: Fact[]; factsTotal: int; evaluatedAt: string;
  // P1 (§4.2) qo'shimchalar: decisions[], hints, reflect
}
Hint = { stage; title; todo; example?; commonMistake?; sources: Source[] }
```

### 11.4. "Ish yo'li" (P2, §5)

```ts
CaseSpeaker = 'client'|'clerk'|'judge'|'secretary'|'respondent'|'witness'|'officer'|'investigator'|'chief'|'you'|'system'
Scene = { witnessIn; judgeIn; judgeEntries: int; clientPresent; everyoneStands; clientMood: 'neutral'|'uncertain'|'upset'|'reassured'|'calm'|'confused' }
CaseLine = { id; speaker: CaseSpeaker; text; scene: Scene; emotion?: Emotion }
CaseOption = { id; text; kind: 'say' | 'act' }
StageView = { id; number; title; place; goal; status: 'open'|'active'|'done'|'returned'; score: int | null }
Decision = { at; prompt|null; chose; tone: 'good'|'bad'|'info'|null; points: int; why|null; better|null; article|null }
CaseSnapshot = {
  caseId; kind; title; note;
  parties: { role: CaseSpeaker; label; name; voice?: 'elder_m'|'male'|'female'|'female_alt' }[];
  stages: StageView[]; stage: string | null;
  lines: CaseLine[]; options: CaseOption[];
  await: 'stand' | 'sit' | 'draft' | null; standing: boolean;
  feedback: { tone: 'good'|'bad'|'info'; message; article: string | null } | null;
  facts: { id; label; detail }[]; evidence: { id; label; detail }[];
  draft: ClaimDraft | null; rulings: { kind: 'accepted'|'returned'|'scheduled'|'judgment'; title; body: string[]; articles: string[] }[];
  scene: Scene; stageDone: boolean;
  code: { title; url; edition; retrievedAt; articles: { number; title; text; url }[] };
  hints: int;
  result: { score: int; verdict: string|null; good: string[]; notes: string[]; log: Decision[]; hints: int; reflect: string|null } | null;
}
CaseActRequest =
  | { type: 'enter'; clientActionId; stage } | { type: 'choose'; clientActionId; optionId }
  | { type: 'stand'; clientActionId; up: boolean } | { type: 'draft'; clientActionId; draft: ClaimDraft }
  | { type: 'hint'; clientActionId } | { type: 'leave'; clientActionId }
```

### 11.5. Hozirgi farqlar (adapter nima qilyapti)

| Sizning javob | Bizning kontrakt | Adapter | Backend tuzatgach |
|---|---|---|---|
| `durationMinutes: 25` | `"25"` | `String()` | olib tashlanadi |
| `briefing: "…"` | `{workplace, position, authority[], task[]}` | gaplarga bo'lish, «Maxfiy» → `authority` | olib tashlanadi |
| `options` yo'q | `[]` | `[]` qo'yadi | olib tashlanadi |
| `sessionId: "sim_…"` | `"rmt_sim_…"` | prefiks | qoladi (marshrutlash uchun) |
| noma'lum event turi | — | tashlanadi | qoladi (himoya) |
| bir turn'da bir necha so'zlovchi | bitta so'zlovchi | **yo'q** (§3.2 kerak) | — |
| `'` / `’` imlo | `ʻ` / `ʼ` | **yo'q** (§3.4 kerak) | — |
