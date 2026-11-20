# LexSim — backend va AI qismini "tayyor" holatga yetkazish bo'yicha to'liq topshiriq

**Kimga:** backend va AI dasturchisi hamda uning agenti.
**Kimdan:** frontend jamoasi (Next.js 16 platformasi).
**Sana:** 2026-11-21.
**Asos:**
- serverni o'qish rejimida audit qildik: kod, servislar, loglar, resurslar. Hech narsa o'zgartirilmadi;
- backend v1.2 bilan real integratsiya sinovidan o'tkazdik;
- `COURT_BACKEND.md` va unga yozgan javobingizni o'qidik.

**Shart:** hammasi **o'zimizning server va o'zimizning modellarimiz** bilan qilinadi. Tashqi AI API ishlatilmaydi.

> **Maqsad:** platforma demo emas, haqiqiy o'quv mahsuloti bo'lib ishlasin.
> - Har qanday javob **3 soniyadan** tez kelsin. LLM ishtirok etsa — birinchi so'z **2 soniyada**.
> - Talaba **variant tanlash, matn yozish yoki ovoz bilan gapirish** orqali javob bera olsin. Qaysi usul ochiqligini daraja (level) belgilaydi.
> - Har bir baho, modda va manba **tekshiriladigan** bo'lsin.

Hujjat 4 qismdan iborat:
1. Auditda topilgan muammolar (§1).
2. Darajalar va javob usullari standarti (§2).
3. Bajarilishi kerak bo'lgan ishlar, ustuvorlik bo'yicha (§3–§9).
4. Sizdan kutilayotgan narsalar va qabul mezonlari (§10–§12).

---

## 0. Qisqacha (TL;DR)

| # | Muammo | Ta'siri | Yechim | Ustuvorlik |
|---|---|---|---|---|
| 1 | LLM javobi **61–111 s**. Loglardan: ~40–60 token, ya'ni **< 1 token/s** | Raqib bilan jonli bahs imkonsiz | Runtime'ni almashtirish, yadrolarni ajratish, oqim (streaming), oldindan tayyorlangan variantlar | **P0** |
| 2 | Server **boshqa ishlar bilan bo'lingan**: doimiy `security-agent`, `ai_demo` ilovalari. Load average **43–47 / 56** | LexSim'ning har bir so'rovi navbatda kutadi | Ishlab chiqarish yuklamasini ajratish, CPU kvotalari | **P0** |
| 3 | TTS faqat sessiya cookie'si bilan ishlaydi | "Ish yo'li" xonalarida ovoz yo'q | Server-to-server kalit + oldindan render qilingan ovozlar | **P0** |
| 4 | Ayol ovozlari bitta erkak ovozining balandligini oshirib hosil qilingan | Sun'iy eshitiladi, professional emas | Barcha qat'iy gaplarni Chatterbox bilan oflayn render qilish | **P1** |
| 5 | Erkin javobni tushunish (NLU) bizning "Ish yo'li" ishlari uchun yo'q | Variantsiz (matn/ovoz) rejimni yoqib bo'lmaydi | `/nlu/match` endpoint'i (§4) | **P0** |
| 6 | Server kodi bitta 1 742 qatorli fayl, ssenariyga xos 34 ta qiymat kod ichida, unit test yo'q | Yangi ish qo'shish sekin va xatoga moyil | Modullarga bo'lish, ma'lumotni kontentga chiqarish, testlar | **P1** |
| 7 | "Ish yo'li" holati Next serverda xotirada saqlanadi | Qayta ishga tushganda talaba ishi yo'qoladi | Saqlashni backend'ga (Postgres) o'tkazish | **P1** |
| 8 | O'qituvchi, guruh va natijalar jurnali yo'q | Ta'lim muassasasi uchun yaroqsiz | xAPI statement ombori va o'qituvchi API'si | **P1** |
| 9 | Kirish ma'lumotlari ochiq (SSH paroli chatda) | Xavfsizlik | Parolni almashtirish, faqat kalit bilan kirish | **P0** |

---

## 1. Audit natijalari (faktlar)

### 1.1. Server va resurslar

| | Qiymat |
|---|---|
| CPU | 56 mantiqiy yadro, **GPU yo'q** |
| RAM | 125 GiB (bo'sh ~3 GiB, kesh ~86 GiB) |
| Disk | `/home` 778 GB, 46% band |
| Load average | **43–47** (sizning `idle_bench.log`ingiz bo'yicha). LLM bo'sh paytda ham `qwen36` jarayoni **~2 190% CPU** ishlatgan |

Bir vaqtda ishlayotgan boshqa jarayonlar:
- `security-agent` — `--continuous --llm-rounds 2`: LLM'dan doimiy foydalanadi;
- `ai_demo/apps/app_uaz.py` — ~100% CPU;
- `app_stt.py`, `app_mms.py`, `app_kotib.py`.

LLM portiga (`:8000`) LexSim'dan tashqari **lokal (127.0.0.1)** ulanishlar ham bor.

**Xulosa:** LexSim boshqa loyihalar bilan bir xil CPU va bir xil LLM navbatida turibdi. O'zingiz ham benchmark uchun `security-agent` va `qwen36` ni muzlatgansiz (`SIGSTOP/SIGCONT`) — demak buni bilasiz. Ishlab chiqarishda bunday bo'lishi mumkin emas.

### 1.2. LLM

- **Model:** Qwen3.6-35B-A3B (MoE, ~3B faol parametr), bf16 safetensors, 22 GB.
- **Runtime:** `colibri` — `coli web --auto-tier`, `EXPERT_STORE_AUTO`. Bu ekspertlarni xotira va disk o'rtasida ko'chiradigan runtime, **kam xotirali** mashinalar uchun mo'ljallangan.
- **Prompt va javob:** prompt ~300 token, `max_tokens: 130`, 2 gapdan keyin to'xtatiladi.
- **Loglardagi o'lchovlar:** 61 132, 111 547, 71 751, 86 563, 73 651 ms. Ya'ni ~40–60 token uchun 60–110 s.
- **Taqqoslash uchun:** A3B sinfidagi MoE model 56 yadroli CPU'da odatda o'nlab token/s beradi. Sizning holatda bu ko'rsatkich 20–40 baravar past. Sabab model emas, **runtime va resurs raqobati**.

### 1.3. Backend kodi

- `lexsim_server.py` — 1 742 qator: `http.server.ThreadingHTTPServer`, `urllib`, SQLite. Unda kontrakt, dvigatel, LLM, RAG, ovoz va monitoring bir joyda.
- **Ssenariyga xos qiymatlar kod ichida (34 ta):**
  - `32-P`, `25 620 …`, `ijara`, `penya`;
  - LLM tekshiruvidagi ruxsat etilgan raqamlar ro'yxati qat'iy yozilgan: `"2022 32 544 578 541 326 262 333 8.5 6.4"`.

  Yangi ish qo'shish uchun kodni o'zgartirish kerak bo'ladi.
- **Testlar:** unit yoki integration testlar yo'q (`test_*.py` topilmadi). RAG uchun `eval/` mavjud: aniqlik 0,967 — juda yaxshi.
- **Ijobiy tomonlar:**
  - idempotentlik;
  - har bir sessiya uchun alohida lock;
  - async turn (202);
  - monitoring paneli;
  - LLM chiqishini tekshirish (yangi raqam yoki modda bo'lsa rad etish);
  - imlo normallashtirish;
  - maxfiy fayllar `600` ruxsat bilan.

### 1.4. RAG

- **Tarkib:** bge-m3 + reranker, PostgreSQL, 2 267 norma, `LOCK` — bitta model nusxasi, so'rovlar navbat bilan ishlanadi.
- **Tezlik:** sizning javobingizga ko'ra ~1,5 s.
- **Kamchilik:** bir vaqtda ko'p talaba bo'lsa, navbat cho'ziladi (§5.4).

### 1.5. Ovoz

- **TTS:** MMS (VITS) — bitta erkak ovozi, qolgan 3 tasi pitch/tempo o'zgartirib hosil qilingan. Chatterbox (7002) tabiiyroq, lekin ~70 s/gap.
- **STT:** `kotib` dvigateli.
- **Cheklov:** `/voice/tts` va `/voice/stt` faqat **sessiya cookie'si bilan** ishlaydi: «Avval sessiya oching». Shuning uchun bizning "Ish yo'li" xonalarida (mehnat va o'g'irlik ishlari) server ovozini ishlatib bo'lmaydi.

---

## 2. Javob usullari va darajalar standarti (asosiy mahsulot qarori)

**Tamoyil:** talaba javobni uch usulda bera oladi — **variant tanlash**, **matn yozish**, **ovoz bilan aytish**. Qaysi usul ochiq bo'lishi va qanday baholanishini **daraja** (level) belgilaydi.

Daraja va rejim alohida o'qlar:
- **daraja** — qiyinlik va yordam miqdori;
- **rejim** (`tutorial` / `assessment`) — baho qanday hisoblanishi: mashq yoki imtihon.

### 2.1. Darajalar

| | **1. Boshlang'ich** (`beginner`) | **2. O'rta** (`intermediate`) | **3. Professional** (`advanced`) |
|---|---|---|---|
| Kim uchun | 1–2-kurs, birinchi marta | 3–4-kurs | bitiruvchi, amaliyotchi |
| **Variantlar** | ✅ har doim ko'rinadi: 3 ta foydali + 1 ta ishonarli xato | 🔒 yashirin. «Variantlarni ko'rsatish» — **−10 ball**, shu lahza uchun | ❌ yo'q |
| **Matn** | ✅ ixtiyoriy | ✅ asosiy usul | ✅ |
| **Ovoz** | ✅ ixtiyoriy | ✅ | ✅ **tavsiya etiladi**. Matn faqat qulaylik uchun ochiq qoladi (WCAG talabi), lekin `inputMode` hisobotda ko'rinadi |
| Maslahat (`hint`) | −5, bir lahzaga bir marta | −5 | ❌ yo'q |
| Darhol fikr-mulohaza (`feedback`) | ✅ har javobdan keyin | ⚠️ faqat jiddiy xatoda (etika, protsess buzilishi) | ❌ faqat oxiridagi tahlilda |
| Sudya qattiqligi | yumshoq, tushuntiradi | standart | real sud: to'xtatadi, qayta so'raydi |
| Raqib (LLM) | shablonga yaqin, qisqa | moslashuvchan | qattiq: e'tiroz, iltimosnoma, eng zaif joyingizga hujum |
| Vaqt bosimi | yo'q | yumshoq: 60 s jimlikdan keyin sudya eslatadi | 30 s jimlik — sudya «Javob bering» deydi, `communication` dan ball tushadi |
| Erkin javobni tushunish | variantga moslash (NLU), past ishonch bo'lsa aniqlashtiruvchi savol | NLU + semantik baholash | NLU + semantik + **LLM-hakam** (§4.4) |

### 2.2. Javob usullarining kontrakti

**Barcha javob endpoint'lariga:**
- **sessiya** (`/sessions/{id}/turns`);
- **ish** (`/cases/{id}/act`, `type: "choose" | "say"`).

```ts
// so'rov
{ clientTurnId, optionId?: string, text?: string,            // aniq bittasi (hozirgidek)
  inputMode: 'option' | 'text' | 'voice',                    // YANGI: qanday javob berildi
  stt?: { confidence: number, durationMs: number } }         // YANGI: ovoz bo'lsa (STT natijasi)

// snapshot / case
{ level: 'beginner' | 'intermediate' | 'advanced',
  inputModes: Array<'option' | 'text' | 'voice'>,            // shu lahzada ochiq usullar
  options: [...],                                            // beginner: to'liq; intermediate: [] (so'ralsa ochiladi); advanced: []
  optionsRevealed: boolean,                                  // intermediate'da variantlar ochilganmi
  silenceSec: number | null }                                // shu daraja uchun jimlik chegarasi
```

- **Yaratishda:** `POST /sessions {scenarioId, mode, level}` va `POST /cases {kind, level}`. Sukut bo'yicha `beginner`.
- **Yangi amal:** `POST /cases/{id}/act {type:"reveal"}` — intermediate'da variantlarni ochadi (−10).
- **Ovozli javob baholanishi:**
  - STT xatolarini bilish uchun `stt.confidence` qo'shiladi;
  - `confidence < 0.6` bo'lsa, sudya «Iltimos, aniqroq takrorlang» deydi va ball ayirilmaydi;
  - og'zaki nutqda «Hurmatli sud» kabi murojaat mezoni yumshoqroq: STT uni noto'g'ri yozib qo'yishi mumkin.

### 2.3. Bizning tomonda allaqachon tayyor

- **Ovoz yo'llari:** ovoz yozib olish (`T` tugmasi) → `/voice/stt` → matn; ekranda ko'rinadi, talaba tahrirlab yuboradi.
- **Iqtisodiy sud sahifasi** (`/sud/[id]`): erkin matn va ovoz, `G` bilan turish, `M` bilan maslahat, LLM kutish holati, IPK havolalari.
- **"Ish yo'li" ishlari:**
  - variantlar va maslahat (−5);
  - har bosqich tahlili: `decisions`, «yaxshiroq javob», modda;
  - mulohaza savoli, xAPI eksport.

Qo'shiladigan: daraja tanlash va matn/ovoz javoblari. Ular backend'dagi NLU tayyor bo'lgach ulanadi (§4).

---

## 3. P0 — tezlik: LLM (eng katta muammo)

**Maqsadli ko'rsatkichlar (o'lchanadi, §11):**

| O'lchov | Hozir | Maqsad |
|---|---|---|
| LLM birinchi token (TTFT), ~400 token prompt | 45–70 s | **≤ 1,5 s** (p50), ≤ 3 s (p95) |
| Generatsiya tezligi | < 1 token/s | **≥ 15 token/s** |
| 2 gaplik raqib javobi (to'liq) | 61–111 s | **≤ 5 s** (p50), ≤ 8 s (p95) |
| 2 talaba bir vaqtda | navbat | har biri ≤ 8 s |

### 3.1. Resurslarni ajratish (1-kun)

1. **Ishlab chiqarish va tajriba ishlarini ajrating.** `security-agent` va `ai_demo` ilovalari LexSim bilan bir mashinada ishlamasin. Iloji bo'lmasa:
   - systemd'da LexSim xizmatlariga `CPUWeight=1000` va `Nice=-5`, boshqalariga `CPUWeight=50`, `Nice=10`, `CPUQuota=…`;
   - LLM'ga **qat'iy yadrolar**: `CPUAffinity=0-23` (fizik yadrolar), RAG va TTS'ga `24-39`, qolganlari boshqa ishlarga.
2. **LLM serverini faqat LexSim ishlatsin.** Boshqa mijozlar uchun alohida instans yoki alohida port, alohida kvota bilan.
3. `vm.swappiness=1`. Model og'irliklari `mlock` bilan RAM'da tursin, ekspertlar diskka chiqarilmasin. RAM yetarli: 125 GiB.

### 3.2. Runtime: `colibri --auto-tier` → `llama.cpp` (`llama-server`)

**Nega:** `--auto-tier` va `EXPERT_STORE_AUTO` ekspertlarni xotira bilan disk o'rtasida ko'chiradi. 125 GiB RAM'li serverda bu faqat sekinlik qo'shadi. `llama.cpp`:
- x86 CPU'da MoE uchun eng yaxshi optimallashtirilgan, AVX-512 va AMX bor bo'lsa ishlatadi;
- OpenAI mos `/v1/chat/completions`, streaming;
- continuous batching va prompt-kesh.

**Qadamlar:**
1. Modelni GGUF'ga o'tkazing: `convert_hf_to_gguf.py`, keyin `Q4_K_M` va `Q5_K_M`.
   - ⚠️ Qwen3.6 gibrid arxitektura (`linear_attention` + `full_attention`). Avval ishlatayotgan `llama.cpp` versiyangiz shu arxitekturani qo'llashini tekshiring.
   - Qo'llamasa, **zaxira model:** Qwen3-30B-A3B-Instruct-2507 GGUF yoki boshqa A3B-sinf instruct model. O'zbekcha sifat §3.5 dagi baholash to'plami bilan solishtirilsin.
2. Ishga tushirish (boshlang'ich parametrlar, o'lchab sozlanadi):

   ```bash
   llama-server -m qwen-a3b-Q4_K_M.gguf \
     --host 127.0.0.1 --port 8000 \
     -t 24 -tb 24 \                    # fizik yadrolar (o'lchab tanlang)
     -c 8192 --parallel 2 \            # 2 ta bir vaqtdagi suhbat
     --cont-batching --cache-reuse 256 \
     --mlock -fa on \
     --jinja --reasoning-budget 0      # "thinking" o'chiq (hozir ham enable_thinking:false)
   ```

3. **Prompt kesh.** Tizim prompti (rol, uslub, taqiqlar, ruxsat etilgan moddalar) har chaqiruvda bir xil. Uni oldinga qo'ying, o'zgaruvchan qism (talaba gapi) oxirida bo'lsin. Shunda `--cache-reuse` TTFT'ni keskin kamaytiradi.
4. **Benchmark** — §11 bo'yicha, eski va yangi runtime yonma-yon, jadval bilan.

### 3.3. Oqim bilan uzatish (streaming)

Hozir to'liq javob kutiladi, keyin 202 va polling. Kerak:
- `GET /sessions/{id}/stream` — **Server-Sent Events**. Har bir gap (jumla) tayyor bo'lishi bilan `dialogue.npcTurnPartial` yuboriladi, oxirida `dialogue.npcTurn`.
- **TTS jumla-jumla.** Birinchi jumla tayyor bo'lishi bilan ovozlanadi. Talaba raqibning birinchi so'zini ~2–3 s da eshitadi.
- Polling (`events?after=N`) zaxira sifatida qoladi: biz ikkalasini ham qo'llaymiz.

### 3.4. Gibrid: oldindan tayyorlangan variantlar + LLM

Har bir LLM lahzasi (`answer`, `rebut`, `on_motion`, `closing`) uchun:
1. **Oflayn**, tunda: har lahza uchun 20–40 ta javob varianti yaratiladi. Har biri tekshiruvdan (`llm_check`) o'tadi va mentor ko'zdan kechiradi. Embeddinglari (bge-m3) saqlanadi.
2. **Ish vaqtida:** talaba gapining embeddingi variantlar bilan solishtiriladi.
   - Moslik ≥ 0,8 bo'lsa → tayyor variant **< 300 ms** da qaytadi, ovozi oldindan render qilingan.
   - Past bo'lsa → LLM chaqiriladi, streaming bilan.
3. Natija:
   - aksariyat holatda bir zumda tabiiy va tekshirilgan javob;
   - LLM faqat haqiqatan kutilmagan gapda ishlaydi;
   - server yuklamasi 5–10 baravar kamayadi.

### 3.5. O'zbekcha sifatni o'lchash

`eval/` RAG uchun bor. LLM uchun ham kerak:
- **Baholash to'plami:** 60 ta lahza × 3 ta talaba gapi.
- **Mezonlar:**
  - o'zbek lotin imlosi va grammatikasi;
  - pozitsiyaga mos kelishi;
  - taqiqlangan narsa yo'qligi;
  - modda va raqamlar to'g'riligi.
- Har model yoki runtime o'zgarishida avtomatik yuritiladi. Hisobot: `eval/natija_llm_<model>.md`.

---

## 4. P0 — erkin javobni tushunish (NLU) — variantsiz rejim uchun asos

Bizning "Ish yo'li" dvigateli (mehnat va o'g'irlik ishlari, `src/server/case/*.ts`) har bir lahzada variantlar ro'yxatiga ega. Har bir variantda quyidagilar bor:
- `id` va matn;
- `tone`: `good` | `bad`;
- jarima va sababi;
- modda;
- natija (`next` / `effect`).

Matn yoki ovozli javobni qabul qilish uchun talaba gapini **eng yaqin niyatga** (variantga) moslash kerak. Bizdagi oddiy leksik moslik (`src/lib/uz.ts`) faqat variant matnini so'zma-so'z aytishga yaraydi. Erkin gap uchun semantik NLU kerak.

### 4.1. Endpoint

```
POST /api/v1/nlu/match            (server-to-server, X-LexSim-Key bilan, §6)
{
  "utterance": "hurmatli sud men mijozim kasal bo'lganini va varaqasi borligini aytmoqchiman",
  "inputMode": "voice",
  "stt": { "confidence": 0.82 },
  "context": { "case": "labour", "stage": "hearing", "node": "h-explain",
               "prompt": "Daʼvogar tomoni, talablaringizni quvvatlaysizmi? Tushuntirish bering." },
  "candidates": [
    { "id": "explain", "text": "Hurmatli sud! Talabni quvvatlaymiz. Daʼvogar 9–10-oktabr kunlari kasal boʻlgan …",
      "tone": "good", "examples": ["…qoʻshimcha toʻgʻri iboralar…"] },
    { "id": "thin",    "text": "Hurmatli sud, arizada hammasi yozilgan.", "tone": "bad" },
    { "id": "angry",   "text": "Hurmatli sud, bu korxona doim xodimlarga zulm qiladi!", "tone": "bad" }
  ],
  "rubric": { "mustAddress": true, "mustCiteFacts": ["sick","notified"], "forbidden": ["pora","tanish"] }
}
→ 200 {
  "match": { "id": "explain", "score": 0.86 } | null,
  "alternatives": [ { "id": "thin", "score": 0.31 } ],
  "quality": { "address": true, "factsCited": ["sick"], "factsMissing": ["notified"],
               "articles": [ { "label": "FPK 227-modda", "valid": true } ],
               "ethics": "ok" | "violation", "politeness": 0.9 },
  "clarify": "Hurmatli sud, … — qaysi holatlarga tayanasiz?" | null,
  "ms": 140
}
```

**Qoidalar:**
- `score ≥ 0.75` → moslik. `0.5–0.75` → `clarify`: sudya yoki mijoz aniqlashtiruvchi savol beradi, ball ayirilmaydi. `< 0.5` → `match: null` (biz «tushunmadim, qayta ayting» deymiz).
- `tone: "bad"` variantga ishonch bilan mos kelsa, xato hisoblanadi: talaba xatoni o'z so'zi bilan aytgan.
- Etika buzilishi (pora, bosim) **har doim** ustun turadi.
- Bu ostonalar dastlabki qiymatlar. Mentor belgilagan to'plam (§4.3) asosida kalibrlang.

**Tezlik:** **p95 ≤ 800 ms**. Faqat embedding va reranker ishlatiladi, LLM ishlatilmaydi. bge-m3 va reranker allaqachon serverda bor.

### 4.2. Erkin javob sifatini baholash (darajalar bo'yicha)

- **beginner va intermediate:** `quality` — murojaat bormi, faktlar, moddalar to'g'riligi, etika. Ball bizning dvigatelda variant jarimasiga qo'shimcha hisoblanadi.
- **advanced:** qo'shimcha **LLM-hakam** (§4.4).

### 4.3. Kalibrlash to'plami

Har bir lahza uchun mentor 10–20 ta real talaba gapini belgilaydi: `good`, `bad` va qaysi variantga mos. Kalibrlash fayli: `eval/nlu_<case>.jsonl`. Ko'rsatkichlar:
- top-1 aniqlik **≥ 0,85**;
- `bad` niyatni `good` deb tasniflash **≤ 3%** — bu eng xavfli xato.

### 4.4. LLM-hakam (faqat advanced, oflayn yoki fon rejimida)

Talabaning to'liq javobi uchun quyidagilar baholanadi:
- huquqiy mantiq;
- dalillarga tayanish;
- tuzilma (talab → asos → dalil → so'rov);
- odob.

Natija — 0–3 ball va 1 jumla izoh. Faqat `decisions[].why` va `better` uchun ishlatiladi.

**Talablar:**
- Faqat **bosqich oxirida**, fon rejimida ishlaydi; talaba kutmaydi.
- Natija deterministik ballni **almashtirmaydi**: ±10 ball chegarasida tuzatadi.
- Har bir modda raqami RAG'dan tasdiqlanadi.

---

## 5. P0/P1 — ovoz

### 5.1. Server-to-server kirish (P0)

Hozir `/voice/tts` va `/voice/stt` faqat iqtisodiy sud sessiyasi cookie'si bilan ishlaydi. Kerak:
- `X-LexSim-Key: <maxfiy kalit>` sarlavhasi bilan **bizning Next serverimiz** uchun to'liq kirish. Kalit faqat server tomonda turadi, brauzerga chiqmaydi.
- Kalit uchun alohida rate limit: masalan TTS 300/min, STT 120/min.
- Bizning serverimiz har bir talabani `X-LexSim-Owner: <hash>` sarlavhasida yuboradi. Siz kvota va logni shu bo'yicha yuritasiz.

### 5.2. Oldindan render (P0)

Barcha **qat'iy** gaplarni oflayn render qiling: sudya, kotib, devonxona xodimi, mijoz, tergovchi va hokazo. "Ish yo'li" va iqtisodiy sud ishlarida ular ~300 ta. Chatterbox (~70 s/gap) bu ish uchun mos, chunki **oflayn** ishlaydi.

```
POST /api/v1/voice/prerender   (X-LexSim-Key)
{ "items": [ { "text": "…", "voice": "elder_m" }, … ] }      → 202 {jobId}
GET  /api/v1/voice/prerender/{jobId}                        → {done, total, failed[]}
```

- Natija keshga tushadi. Keyingi `/voice/tts` so'rovi o'sha matn uchun **< 100 ms** da qaytadi.
- Matnlar ro'yxatini biz eksport qilamiz: `tools/voice/lines.mjs` (biz yozamiz) → JSON.

### 5.3. Ovoz sifati (P1)

- **Ayol ovozlari** pitch-shift bilan emas, haqiqiy ayol ovozi bilan bo'lsin. Variantlar:
  - (a) Chatterbox — faqat oldindan render uchun;
  - (b) MMS yoki VITS'ni ayol ovozida fine-tune qilish: 1–2 soat toza yozuv yetadi.
- **Talab:** 4 ta ovoz → kamida **2 ta haqiqiy** (erkak va ayol), qolgan 2 tasi ularning yengil variatsiyasi.
- **Dinamik gaplar** (LLM) MMS'da qoladi, jumla-jumla streaming bilan (§3.3).

### 5.4. STT (P1)

- **Lug'at (hotwords):** «Hurmatli sud», «daʼvogar», «javobgar», «iltimosnoma», «ishonchnoma», «penya», «modda», raqamlar va «FPK / IPK / JPK».
- **Ko'rsatkichlar:**
  - so'zlar bo'yicha xato (WER) huquqiy matnda **≤ 15%**;
  - 5 s audio uchun **≤ 1,5 s**.
- **Javobga `confidence`** qo'shilsin: 0–1. §2.2 shu qiymatdan foydalanadi.
- **Maxfiylik:** audio diskka yozilmaydi; buni allaqachon qilyapsiz.

### 5.6. Lab-sinxron uchun nutq vaqtlari (P1 — personajlar sifatiga eng katta ta'sir)

Azure o'zbek ovozlari uchun viseme bermaydi. Hozir biz matndagi harflarni ovoz davomiyligiga teng taqsimlaymiz — bu taxminiy usul. Sizning MMS-TTS (VITS) modelingiz ichida har bir harfning aniq davomiyligi bor (duration predictor, `w_ceil`). Talab:

```
POST /api/v1/voice/tts?timings=1
  → 200 audio/mpeg  +  sarlavha X-LexSim-Timings: <base64(JSON)>
    yoki alohida: POST /api/v1/voice/timings {text, voice} → {"units":[{"ch":"s","t0":0.000,"t1":0.061}, …], "durationMs": 2310}
```

- `units` — har bir harf yoki harf birikmasi (`sh`, `ch`, `ng`, `oʻ`, `gʻ`) va uning boshlanish/tugash vaqti (s). Biz uni visemaga o'zimiz aylantiramiz (`src/lib/visemes.ts`).
- Keshdagi gaplar uchun vaqtlar ham keshlanadi.
- Boshqa (Azure yoki yozib olingan) audio uchun zaxira yo'l: CTC majburiy hizalash, `MMS-300M` aligner, `uzb`. Faqat oflayn yoki serverda. O'zbekcha sifati o'lchansin.
- **Kelajak (P2):** LAM Audio2Expression (ARKit-52, ONNX, CPU'da ~45 ms / 1 s audio). Gap tayyor bo'lganda mimika treki ham qaytariladi: `{fps:30, names:[…52], frames:[[…]]}`. Bizning modellarda ARKit'ning 52 ta mimikasi bor.

### 5.5. RAG va reranker parallelligi (P1)

`tools/api.py` da `LOCK` — bitta model, so'rovlar navbat bilan. 30 talaba uchun:
- bge-m3 encoder'ni **batch** rejimda ishlating: 10–20 ms oyna ichida yig'ilgan so'rovlarni birga ishlang;
- reranker uchun 2 ta ishchi.

Maqsad: 10 ta parallel so'rovda p95 ≤ 2 s.

---

## 6. P1 — arxitektura va kod sifati

1. **Modullarga bo'lish.** `lexsim_server.py` (1 742 qator) quyidagilarga ajratilsin:
   - `api/` — HTTP qatlam;
   - `engine/` — protsedura dvigateli;
   - `content/` — ssenariy, rol, lahza;
   - `ai/` — LLM, NLU, RAG mijozlari;
   - `voice/`;
   - `store/`;
   - `monitor/`.
2. **HTTP qatlami.** `ThreadingHTTPServer` + `urllib` → **FastAPI + uvicorn**: async, SSE uchun qulay; `httpx` bilan pool va timeout. Kontrakt o'zgarmaydi.
3. **Kontent kod emas, ma'lumot.** Ssenariyga xos 34 ta qiymat kod ichida turibdi, jumladan ruxsat etilgan raqamlar ro'yxati (`"2022 32 544 578 541 …"`). Hammasi `scenarios.json` yoki `roles.json` ga, har bir ish uchun alohida o'tsin:
   - `facts`, `numbers`, `allowedArticles`;
   - `moments`, `templates`, `prerendered`.

   Yangi ish qo'shish = yangi JSON + mentor tasdig'i. Kod o'zgarmaydi.
4. **Yagona kontrakt manbai.** Bizning Zod sxemalarimizdan JSON Schema eksport qilinadi (biz `contracts.schema.json` beramiz). Siz uni pydantic model'larga generatsiya qilasiz. CI har bir javobni shu sxemaga qarshi tekshiradi.
5. **Testlar.**
   - **Unit:** protsedura bosqichlari, `llm_check`, imlo normallashtirish, baholash.
   - **Integration:** ikkala rol bo'yicha to'liq oqim; idempotentlik; 409 va 403.
   - **Kontrakt:** JSON Schema.
   - **Yuklama:** `locust` yoki `k6` — 30 talaba, §11.
6. **Monitoring.** Paneldan tashqari Prometheus formatidagi `/metrics` bo'lsin:
   - har bir qism uchun p50/p95: LLM TTFT va to'liq vaqt, RAG, NLU, TTS, STT;
   - navbat chuqurligi;
   - fallback ulushi.
7. **Xatolar.** Strukturali JSON log: `requestId`, `sessionId`, qism, ms, natija. Python traceback foydalanuvchiga chiqmaydi.

---

## 7. P1 — saqlash, foydalanuvchilar, o'qituvchi

### 7.1. "Ish yo'li" holatini saqlash

Hozir mehnat va o'g'irlik ishlari bizning Next serverimiz xotirasida turadi. Server qayta ishga tushganda talaba ishi yo'qoladi: bugun ham shunday bo'ldi. Ikki yo'l:
- **(a) tavsiya.** Siz Postgres'da (RAG uchun allaqachon bor) `case_state` jadvali va kichik KV API berasiz:

  ```
  PUT /api/v1/store/cases/{id}  {owner, kind, state, version}
  GET /api/v1/store/cases/{id}
  ```

  Dvigatel bizda qoladi, saqlash sizda. Optimistic locking — `version` bo'yicha.
- **(b)** `/cases` dvigatelini to'liq backend'ga o'tkazish (P2, `COURT_BACKEND.md` §5).

### 7.2. Foydalanuvchilar va o'qituvchi

- **Hisob:**
  - talaba — anonim token yoki o'qituvchi taklif kodi;
  - o'qituvchi — login.
- **Guruh:** `cohortId`, topshiriq — ish + daraja + muddat.
- **xAPI statement ombori** (biz hozir JSON eksport qilyapmiz):

  ```
  POST /api/v1/xapi/statements          (bizning server yuboradi)
  GET  /api/v1/teacher/cohorts/{id}/summary
       → har bir talaba: ishlar, ballar, xatolar, maslahatlar, vaqt
  GET  /api/v1/teacher/cohorts/{id}/hotspots
       → eng ko'p xato qilingan lahzalar (modda bilan)
  ```

- **Maxfiylik:**
  - ism o'qituvchida qoladi, serverda faqat `studentHash`;
  - saqlash muddati: sessiyalar 180 kun, ovoz — hech qachon.

### 7.3. LMS (P2)

Moodle yoki Canvas uchun LTI 1.3: Deep Linking va Assignment & Grade Services. Ombor tayyor bo'lgach qilinadi.

---

## 8. P0 — xavfsizlik va infratuzilma

1. **SSH paroli suhbatda ochiq yuborilgan** — darhol almashtiring. `PasswordAuthentication no`, faqat kalit bilan kirish.
2. **Ishlab chiqarish serverida begona ishlar bo'lmasin.** Hozir u yerda `security-agent` tashqi saytga doimiy so'rovlar yuborib turibdi. Bu resursni egallaydi va xavfsizlik nuqtai nazaridan LexSim bilan bir mashinada turmasligi kerak.
3. **LLM porti** (`0.0.0.0:8000`) — faqat `127.0.0.1` ga bog'lansin. Backend unga lokal ulanadi.
4. **Monitoring paneli** (`/monitor`) — faqat admin tokeni bilan, faqat lokal tarmoqdan. Tokenni `.env` da saqlang.
5. **Zaxira nusxa.** `sessions.db` (keyinchalik Postgres) — kunlik zaxira, 14 kun saqlanadi. Tiklash sinovi oyda bir marta.
6. **Hakaton va tarmoq.** Tailscale yoki WireGuard yopiq tunnel orqali: server ↔ demo noutbuk. Qaror server egasida, lekin demo kunidan **3 kun oldin** sinab ko'rilsin.
7. **HTTPS.** Tunnel ichida ham `LEXSIM_SECURE_COOKIE=1`. Bizning Next serverimiz HTTPS orqasida turadi.

---

## 9. Kontent va huquqiy sifat (doimiy jarayon)

1. **Mentor tasdig'i.**
   - Har bir ish va lahza uchun `reviewedBy` va `reviewedAt`.
   - `Source.verifiedAt` to'ldiriladi.
   - Tasdiqlanmagan moddalar UI'da belgilanadi: buni allaqachon qilamiz.
2. **Tahrir nazorati.** lex.uz'dagi moddalar o'zgarganda (RAG bazasi qayta yuklanganda) ta'sirlangan lahzalar avtomatik belgilanadi va qayta ko'rib chiqishga yuboriladi.
3. **Imlo.** ʻ (U+02BB) va ʼ (U+02BC). Backend buni allaqachon qilyapti, CI testi ham shuni tekshirsin.
4. **Penya isbot yuki.** Plenum qarori (OXS163, 4-band) mentor tomonidan tasdiqlansin. Shungacha hisobotda bu haqda da'vo qilinmaydi; to'g'ri qilyapsiz.

---

## 10. Sizdan kerak bo'lgan narsalar

### Javoblar

1. **Server egaligi.** `security-agent` va `ai_demo` LexSim serveridan ko'chiriladimi yoki kvota bilan qoladimi? (§3.1)
2. **`llama.cpp` va Qwen3.6.** `llama.cpp` Qwen3.6 gibrid arxitekturasini qo'llaydimi? Qo'llamasa, qaysi zaxira model (§3.2)? O'zbekcha baholash natijasi bilan javob bering.
3. **Ayol ovozi.** Fine-tune uchun yozuv bormi (§5.3)? Bo'lmasa, Chatterbox bilan oldindan render qilamizmi?
4. **STT.** `kotib` dvigatelining huquqiy matndagi WER ko'rsatkichi qancha (§5.4)?
5. **Saqlash.** Postgres'dagi `case_state` (§7.1 a) bizga qachon ochiladi?

### Topshiriladigan natijalar

| # | Natija | Muddat (taklif) |
|---|---|---|
| D1 | §11 benchmark hisoboti: eski va yangi runtime, eski va yangi resurs taqsimoti | 2 kun |
| D2 | `llama-server` ishlab chiqarishda + SSE (`/stream`) + jumla-jumla TTS | 4 kun |
| D3 | `/nlu/match` + kalibrlash to'plami va hisobot (§4.3) | 5 kun |
| D4 | `X-LexSim-Key` + `/voice/prerender` + 300 ta gap render qilingan | 3 kun |
| D5 | Darajalar (§2) — `level`, `inputModes`, `reveal`, jimlik chegarasi, sudya va raqib qattiqligi | 4 kun |
| D6 | Gibrid: tayyor variantlar + LLM (§3.4) | 4 kun |
| D7 | `case_state` ombori (§7.1) va xAPI statements (§7.2) | 4 kun |
| D8 | Kod refaktori, testlar, `/metrics`, xavfsizlik (§6, §8) | 5 kun (D1–D7 bilan parallel) |
| D9 | TTS bilan harf vaqtlari (§5.6) | 2 kun |

---

## 11. O'lchov protokoli (benchmark)

Har bir o'zgarishdan oldin va keyin, bir xil sharoitda o'lchanadi:
- boshqa ishlar to'xtatilgan **va** ular ishlayotgan — ikkala holat alohida yozilsin;
- har bir o'lchov 20 marta takrorlanadi; p50, p95 va max hisoblanadi.

| Qism | Holat | Qiymat |
|---|---|---|
| LLM TTFT (~400 token prompt) | 1 ta, 2 ta, 4 ta parallel | |
| LLM token/s | | |
| Raqib javobi to'liq (2 gap) | | |
| Tayyor variant moslash (§3.4) | | |
| NLU `/nlu/match` | 1 ta, 10 ta parallel | |
| RAG qidiruv | 1 ta, 10 ta parallel | |
| TTS yangi gap / keshdan | | |
| STT, 5 s audio | | |
| To'liq sud majlisi (8 turn, LLM bilan) | 1, 5, 30 ta talaba | |

Natija `eval/natija_perf_<sana>.md` ga yozilib, bizga yuboriladi.

---

## 12. "Tayyor" degani — qabul mezonlari

- [ ] Protsedura javobi p95 ≤ 300 ms. RAG va NLU javobi p95 ≤ 1,5 s.
- [ ] LLM'li javob: birinchi so'z p95 ≤ 3 s (streaming), to'liq javob p95 ≤ 8 s. Tayyor variant mos kelsa ≤ 300 ms.
- [ ] 30 ta parallel talabada xatolar ≤ 0,5%, p95 ko'rsatkichlar ~1,5 baravardan oshmaydi.
- [ ] Uchala daraja ishlaydi: `beginner` (variant + matn + ovoz), `intermediate` (matn + ovoz, variant −10), `advanced` (ovoz yoki matn, maslahatsiz, oxirida tahlil).
- [ ] `/nlu/match`: top-1 ≥ 0,85, `bad`→`good` ≤ 3% (mentor to'plamida).
- [ ] Barcha qat'iy gaplar oldindan render qilingan, kamida 2 ta haqiqiy ovoz (erkak va ayol).
- [ ] Bizning serverimiz `X-LexSim-Key` bilan TTS va STT'dan istalgan xonada foydalana oladi.
- [ ] Ish holati serverni qayta ishga tushirgandan keyin ham saqlanib qoladi.
- [ ] O'qituvchi guruh natijalarini va eng ko'p xato qilingan lahzalarni ko'radi.
- [ ] Kontrakt JSON Schema bo'yicha CI'da tekshiriladi. Unit, integration va yuklama testlari yashil.
- [ ] Xavfsizlik:
  - [ ] SSH faqat kalit bilan kirishga o'tkazilgan;
  - [ ] LLM porti faqat lokal;
  - [ ] panel himoyalangan;
  - [ ] zaxira nusxa olinadi;
  - [ ] begona ishlar ajratilgan.
- [ ] Har bir modda uchun lex.uz havolasi bor; mentor tasdiqlagan moddalarda `verifiedAt` to'ldirilgan.

---

## Ilova A. Bizning tomonda tayyor turgan narsalar (takrorlamang)

| Narsa | Joy (`lexsim-web`) |
|---|---|
| Adapter (`rmt_`, Zod tekshiruvi, timeout'lar, cookie) | `src/server/remote/court.ts` |
| Iqtisodiy sud sahifasi (3D zal, matn va ovoz, `G` turish, `M` maslahat, LLM kutish, IPK havolalari) | `src/app/sud/[sessionId]/CourtSimClient.tsx` |
| Hisobotda qarorlar tahlili (`decisions`) | `src/app/simulation/[sessionId]/report/ReportClient.tsx` |
| Ovoz: Azure, bo'lmasa sizning server (cookie bilan; §5.1 dan keyin kalit bilan) | `src/server/voice/provider.ts` |
| "Ish yo'li" dvigateli (variantlar, maslahat, tahlil, xAPI) | `src/server/case/*.ts`, `src/app/ish/**` |
| Kontrakt (Zod) | `src/contracts/*.ts` |
| QA (Playwright) | `tools/qa/economic.mjs`, `case.mjs`, `theft.mjs`, `zfight.mjs` … |

## Ilova B. Audit uchun ishlatilgan buyruqlar (faqat o'qish)

`uname`, `nproc`, `free`, `df`, `ps`, `ss`, `systemctl cat`, `journalctl -u lexsim-backend`, `grep`/`sed` (kodni o'qish), `cat settings.json`, `idle_bench.log`.

Hech bir fayl o'zgartirilmadi, hech bir xizmat qayta ishga tushirilmadi.
