# Personajlar: jonlilik, mimika, fizika — holat va yo'l xaritasi

**Kimga:** frontend jamoasi.
**Sana:** 2026-11-21.
**Asos:** kod auditi (`src/components/world/Character.tsx`) va 2024–2026 yillardagi manbalar bo'yicha tadqiqot (havolalar har bir bandda).

## 1. Hozirgi holat — nima bor

| Qatlam | Qanday ishlaydi |
|---|---|
| **Gavda** | Rocketbox mocap (o'tirish, turish, yurish, gapirish imo-ishoralari) + uning ustiga qo'shiladigan protsedura qatlami: egilish, bosh va nigoh, rekvizit uchun qo'l pozalari |
| **Hissiyot** | 7 holat (`Emotion`), FACS bo'yicha: qosh, ko'z qisish, tabassum va **yonoq** (chin tabassum), **burun** (norozilik), **lab siqish** (taranglik), **pastki lab** (ikkilanish), **ko'z ochilishi** (diqqat). Modellarda ARKit'ning to'liq 52 ta mimikasi bor |
| **Ko'z** (`src/lib/liveliness.ts`) | Sakkadalar: davomiylik amplitudaga bog'liq (21 ms + 2,2 ms/°). Mikro-sakkadalar 0,5–2 s oraliqda. Gapirganda nigoh vaqti-vaqti bilan olib qochiladi. Ko'z vertikal ham harakatlanadi |
| **Ko'z qisish** | Assimetrik: ~70 ms yopiladi, ~150 ms ochiladi. Gapirganda ~26/min, tinch holatda ~17/min. Ba'zan ikki marta ketma-ket. Nigoh keskin almashganda va gap tugaganda ham bo'ladi. Qovoq ko'zga ergashib pastga tushadi |
| **Nutq** | Matndan viseme treki, ovoz davomiyligiga moslanadi va ovoz balandligi bilan kuchaytiriladi. Lab ovozdan ~50 ms oldinda. **Urg'u nuqtalari** (so'zning oxirgi unlisi — o'zbek tilida urg'u shunday) — qosh ko'tariladi va bosh yengil irg'aydi |
| **Tinglovchi** | Boshqa birov gapirganda vaqti-vaqti bilan bosh irg'aydi (back-channel), so'zlovchiga qaraydi |
| **Nafas** | Ko'krak va bo'yin bilan; tinch holatda 12/min, odatdagi 14, asabiylashganda 18 |
| **Teri** | Yuzda iliq «sheen» (yorug'lik chetda yumshoq tarqaladi), specular past |
| **Sudya mantiyasi** | Tanaga skin qilingan, pelerina qo'l harakatiga ergashadi |
| **Imkoniyatni hisobga olish** | Kam harakat sozlamasi (reduced motion) yoqilsa, bosh irg'ash va urg'u amplitudasi ikki baravar kichik |
| **QA** | `/dev/face` — uchta yuz yaqindan (`?mood=upset` va hokazo); `/dev/mantle` — mantiya; `src/lib/liveliness.test.ts` |

## 2. Keyingi qadamlar (ta'sir bo'yicha tartiblangan)

| # | Ish | Nega | Kuch | Narx (unumdorlik) |
|---|---|---|---|---|
| 1 | **Haqiqiy nutq vaqtlari bilan lab** — backend MMS-TTS'dan har bir harf uchun davomiylikni qaytaradi (VITS duration predictor) yoki majburiy hizalash qiladi (MMS-300M CTC aligner) | Azure o'zbek ovozlari uchun viseme bermaydi. Hozir harflarni teng taqsimlaymiz — bu taxminiy usul | S (bizda) + M (backend) | 0 |
| 2 | **Jag'ni audiodan boshqarish** (AudioWorklet'da RMS/MFCC) — wLipSync yoki HeadAudio | Pauzada og'iz qimirlamaydi, jag' ovozga aniq mos keladi | S | ~0,3 ms/kadr, asosiy oqimdan tashqarida |
| 3 | **Audiodan to'liq yuz** — LAM Audio2Expression (ARKit-52, ONNX), serverda yoki WebGPU'da gapdan oldin hisoblanadi | Qosh, yonoq va ko'z gap bilan tabiiy harakatlanadi | M | serverda ~45 ms / 1 s audio |
| 4 | **Rocketbox ARKit HD boshlar** (AK_01…AK_52, MIT) — qayta eksport, ishlatilmagan morph'larni olib tashlash | Aniqroq mimika, kichikroq fayl | S–M | morph soni kamayadi |
| 5 | **Qo'l IK va oyoqni qotirish** (CCDIK yoki analitik ikki bo'g'imli IK) | Qo'llar stolga «tegadi», oyoq sirpanmaydi | M | past |
| 6 | **Mantiya va sochga spring-bone** (`@pixiv/three-vrm-springbone`) | Yeng va pelerina harakatga inersiya bilan ergashadi | M | ~0,1 ms/zanjir |
| 7 | **Ko'z shaderi** — alohida shox parda (cornea) qobig'i (clearcoat), nam chiziq, ko'z kosasiga AO | «Shisha ko'z» effekti yo'qoladi | S–M | past |
| 8 | **Soch** — `alphaHash` yoki dithered shaffoflik + MSAA (hozir chekkalari qirrali) | Toza siluet | S | past |
| 9 | **Dialog kamerasi** — so'zlovchiga yumshoq yo'naltirish; sud majlisi uchun DOF faqat dialog paytida, faqat kuchli GPU'da | Diqqat so'zlovchiga qaratiladi | S–M | DOF ~1–2 ms |
| 10 | **Animatsiya LOD** — uzoqdagi yoki kadrdan tashqaridagi personajlar har 2–4 kadrda yangilanadi, yuz qatlami o'chiriladi | 8 ta personajda CPU tejaladi | M | − |

## 3. Qilinmasin

- WebGPURenderer/TSL'ga hozir o'tish (eksperimental, postprocessing va N8AO port qilinmagan).
- To'liq mato yoki soch simulyatsiyasi, ekran-fazoviy SSS (8 ta personaj uchun juda qimmat).
- Simmetrik va qat'iy oraliqdagi ko'z qisish; doimiy «tikilib qarash».
- Bir morph'ni bir necha qatlam vaznsiz yozishi (jag' sakraydi). Hozir har bir morph bitta joyda yoziladi.
- Ready Player Me (2026-yil yanvarda yopildi), Azure'ning o'zbekcha visemelari (mavjud emas).

## 4. Manbalar

- **Azure:** o'zbek ovozlari uchun viseme qo'llab-quvvatlanmaydi — https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts
- **Ko'z qisish modeli:** Trutoiu va boshq. (Disney Research), 2011 — https://la.disneyresearch.com/wp-content/uploads/Modeling-and-Animating-Eye-Blinks-Paper.pdf
- **Ko'z qisish chastotasi:** https://pmc.ncbi.nlm.nih.gov/articles/PMC8500445
- **Eyes Alive** (Lee, Badler, Badler, 2002) — https://www.cis.upenn.edu/~badler/papers/EyesAlive.pdf
- **Lab-sinxron va mimika:**
  - TalkingHead (three.js) — https://github.com/met4citizen/TalkingHead
  - wLipSync — https://github.com/mrxz/wLipSync
  - HeadAudio — https://github.com/kyr0/HeadAudio
  - LAM Audio2Expression — https://github.com/aigc3d/LAM_Audio2Expression
  - NVIDIA Audio2Face-3D — https://github.com/NVIDIA/Audio2Face-3D-SDK
- **Avatarlar va ikkilamchi harakat:**
  - Rocketbox (ARKit) — https://github.com/microsoft/Microsoft-Rocketbox
  - three-vrm springbone — https://www.npmjs.com/package/@pixiv/three-vrm-springbone
- **Tinglovchi bosh irg'ashi** — https://arxiv.org/abs/2507.23298
