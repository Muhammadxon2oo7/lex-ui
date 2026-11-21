# LexSim - metodika: ssenariylarga asoslangan tajribaviy huquqiy ta'lim

**Kimga:** mentorlar, o'qituvchilar, loyiha jamoasi.
**Sana:** 2026-11-21.

---

## 1. Qisqacha

LexSim "Scenario-Based Experiential Legal Learning" yondashuvida qurilgan. Talaba haqiqiy kasb rolida (advokat, jabrlanuvchi vakili, sudya, davlat xizmatchisi) ish boshidan oxirigacha yuradi:
- qaror qabul qiladi va uning oqibatini ko'radi;
- har qarorga modda bilan izoh oladi;
- oxirida o'quv natijalari bo'yicha baholanadi;
- uch qismli refleksiya yozadi.

Bu so'zma-so'z bitta manbadagi atama emas. U quyidagi nazariya va amaliyotlarning birikmasi:
- Kolbning tajribaviy o'qitish sikli;
- Schönning refleksiv amaliyotchi g'oyasi;
- Errington va Clark'ning ssenariyli o'qitish modeli;
- Stuckey'ning "Best Practices for Legal Education" (2007), 5-bob;
- Barton, McKellar va Maharg'ning "Authentic Fictions" (2007) ishi.

Manbalar 5-bo'limda.

---

## 2. Komponentlar va ularning bajarilishi

| # | Komponent (manba talabi) | LexSim'da | Qayerda |
|---|---|---|---|
| 1 | O'quv natijalari va baholash mezonlari oldindan aytiladi | Har xonada 1-4 ta o'quv natijasi, moddalari bilan; xonaga kirganda "Bu xonada nimani o'rganasiz" | `StageDef.outcomes`, kirish kartasi |
| 2 | Haqiqiy kasb rolida, real artefaktlar bilan | Advokat, jabrlanuvchi vakili, raislik qiluvchi sudya, DXM xodimi; ish papkasi, order, da'vo arizasi, bayonnoma | Barcha xonalar |
| 3 | Murakkablik darajaga mos; chalg'ituvchi ma'lumot ataylab bor | 3 daraja (boshlang'ich / o'rta / professional); "tuzoq" ilovalar va variantlar | Darajalar, `trap` |
| 4 | Boshlovchi voqea, ish ma'lumoti, oldindan tayyorgarlik | Vaziyat matni, ish papkasi, kodeks (lex.uz matni) har doim qo'l ostida | Kirish kartasi, "Ish papkasi", "Kodeks" |
| 5 | Qarorlarning oqibati bor; ma'lumot bosqichma-bosqich ochiladi | Tanlov va o'z so'zi bilan javob; dalillar hal qiluv qarori va hukmni o'zgartiradi | Dvigatel (`strength`, `won`) |
| 6 | Yo'l-yo'riq va bosqichma-bosqich kamayuvchi yordam | Maslahat (-5), variantlarni ochish (-10); professional darajada yordam yo'q | Darajalar |
| 7 | Har qarorga aniq izoh, to'g'ri xatti-harakat ham qayd etiladi | Darhol izoh + modda; "Kuchli tomonlar" | `feedback`, `good` |
| 8 | Tuzilmali refleksiya (Kolb; "What? So what? Now what?") | **Uch qismli, majburiy:** "Nima bo'ldi? / Nega? / Endi nima?". Yozilmaguncha keyingi xona ochilmaydi | Natija oynasi |
| 9 | Debrifing alohida, haqiqiy amaliyotga bog'lanadi | Natija oynasi: o'quv natijalari, har qaror tahlili ("yaxshiroq javob", modda) | Natija oynasi |
| 10 | Tajriba doktrinaga bog'lanadi (abstrakt tushuncha) | Har qaror moddaga bog'langan, modda matni lex.uz'dan ochiladi | "Kodeks", tahlil |
| 11 | Takrorlash va o'tkazish | "Qayta o'ynash"; boshqa yo'nalish va ishlar; "Endi nima?" keyingi xonaga reja | Natija oynasi |
| 12 | Baho o'quv natijalariga mos (rubrika) | Har o'quv natijasi qarorlardan baholanadi: erishildi / erishilmadi / bu safar tekshirilmadi, dalillari bilan | `judgeOutcomes` |
| 13 | Etika va kasbiy o'zlik | Pora, natijani kafolatlash, sudga ta'sir, so'kinish va hurmatsizlik - jarima va izoh | Variantlar, `situation` |
| 14 | O'z tajribasidan o'rganishni o'rganish | "Endi nima?" - talabaning o'z rejasi, bayonnomada saqlanadi | Refleksiya |
| 15 | Hamkorlik (ixtiyoriy) | "Bahs" - jamoaviy sud, jamoa chati | `/bahs` |

**O'qituvchi uchun:** bayonnoma (PDF/Word) va xAPI'da o'quv natijalari ("erishdi / erisha olmadi") hamda talabaning refleksiyasi bor.

---

## 3. Jarayon tartibi va ishtirokchilar (haqiqiy tartibda)

### 3.1. Fuqarolik ishi: ishga tiklash (FPK)

| # | Xona | Kim bor | Tartib (modda) |
|---|---|---|---|
| 1 | Advokatlik byurosi | Advokat (talaba), mijoz | Holatlar va dalillarni aniqlash, vakolat: shartnoma va order (FPK 67, 68; "Advokatlik faoliyatining kafolatlari..." Qonun, 4-modda) |
| 2 | Hujjatlar | Advokat | Advokat orderi (Adliya vazirining 1-mh-son buyrug'i), da'vo arizasi (FPK 189-191) |
| 3 | Sud devonxonasi | Advokat, devonxona xodimi | Arizani topshirish; qabul qilish yoki qaytarish (FPK 192, 193, 195) |
| 4 | Sudya kabineti | Sudya, ikkala taraf | Ishni sud muhokamasiga tayyorlash (FPK 201-205) |
| 5 | Sud majlisi zali | Sudya, kotib, da'vogar va vakili, javobgar vakili (yurist), guvoh | Majlis tartibi to hal qiluv qarorigacha (FPK 208-248) |

**Prokuror nega yo'q.** FPK 50-moddasi: prokuror fuqarolik ishida faqat qonunda sanalgan hollarda qatnashadi (yer, davlat mulki, davlatga zarar, ish tashlash) yoki ish uning o'z arizasi bilan qo'zg'atilgan bo'lsa. Moddaning o'zida: "Prokuror boshqa shaxslarning arizasi bilan qo'zg'atilgan ishning muhokamasida o'z tashabbusi bilan ishtirok etishi mumkin emas." Xodim o'zi da'vo bergan ishga tiklash ishida prokuror qatnashmaydi.

### 3.2. Jinoyat ishi: o'g'irlik (JPK) - arizadan hukmgacha

| # | Xona | Kim bor | Tartib (modda) |
|---|---|---|---|
| 1 | IIB navbatchi qismi | Jabrlanuvchi vakili (talaba), jabrlanuvchi, navbatchi | Ariza, ogohlantirish, ro'yxatga olish (JPK 323, 324, 329) |
| 2 | Tergovchi kabineti | Tergovchi, jabrlanuvchi, vakil | Huquqlarni tushuntirish, so'roq, ishora qiluvchi savol taqiqi, bayonnoma (JPK 64, 100, 102, 106, 114) |
| 3 | Tergov bo'linmasi boshlig'i | Boshliq, vakil | Tergovchi harakatsizligi ustidan shikoyat (JPK 358) |
| 4 | **Jinoyat ishlari bo'yicha sud** (yangi) | **Raislik qiluvchi sudya, kotib, davlat ayblovchisi (prokuror) - qoralovchi, himoyachi (advokat) - oqlovchi, sudlanuvchi, jabrlanuvchi va uning vakili, guvoh** | To'liq sud muhokamasi (pastda) |

**4-xonadagi tartib** (har qadam JPK matni bo'yicha):
1. Sud kirib kelganda hamma turadi; sudga tik turib murojaat qilinadi (424).
2. Majlis ochiladi (428), kotib kim kelganini aytadi (429).
3. Sud tarkibi va taraflar e'lon qilinadi, rad qilish huquqi tushuntiriladi (431). Jabrlanuvchi va vakiliga huquqlar tushuntiriladi (436 → 55).
4. Iltimoslar. Iltimos qiluvchi dalil qaysi holatni aniqlashga kerakligini ko'rsatishi shart (438).
5. Davlat ayblovchisi ayblovni o'qiydi, sudlanuvchidan aybiga iqrormi deb so'raladi (439). Dalillarni tekshirish navbati (440).
6. So'roqlar (442): avval sudlanuvchi, keyin jabrlanuvchi, so'ng guvoh (qasamyod va ogohlantirish bilan, 441). Ishora qiluvchi savol taqiqlanadi (102).
7. Sud tergovi tugaydi (448).
8. Muzokara (449): avval davlat ayblovchisi, keyin jabrlanuvchining vakili, himoyachi, sudlanuvchi. Sud tergovida ko'rilmagan dalilni keltirib bo'lmaydi.
9. Sudlanuvchining oxirgi so'zi; bu vaqtda savol berilmaydi (451).
10. Sud maslahatxonaga kiradi (453). Hukm tik turib eshitiladi, shikoyat tartibi tushuntiriladi (473).
11. Hukm faqat sud muhokamasida isbot qilingan dalillarga asoslanadi; aks holda oqlov hukmi chiqadi, aybsizlik prezumpsiyasi bo'yicha (462, 463).

Talabaning ishi hukmni o'zgartiradi: dalillarni yaxshi tekshirtirsa ayblov hukmi chiqadi, zaif ishlasa oqlov hukmi.

**Ataylab baholanmaydi:**
- Jinoyat kodeksi bo'yicha kvalifikatsiya va jazo miqdori (JK moddalari tekshirilgan to'plamda yo'q);
- tergov bosqichidagi ayblov e'lon qilish va himoyachining tergovdagi ishi (hikoyada qisqa bayon qilinadi);
- apellyatsiya bosqichi.

### 3.3. Iqtisodiy sud: «Bahs» ishlari katalogi

«Bahs»da 14 ta ish bor (`docs/BAHS_ISHLARI.md`). Har biri haqiqiy qarorga asoslangan: instansiyalar bir-biriga zid qaror chiqargan, shuning uchun ikkala tomonda ham bahslashadigan narsa bor. Ish papkasida quyidagilar bor:
- holatlar;
- dalillar;
- sanalar zanjiri;
- har tomonning maxfiy faktlari;
- lex.uz normalari (bosilsa, matn ochiladi).

Hukmdan keyin «Haqiqiy ishda» bloki ochiladi: sudlar nima qildi va ish nimani oʻrgatadi. Bu debrifing (9-komponent) va haqiqiy amaliyotga bogʻlash (10-komponent). Talaba oʻz bahsini haqiqiy natija bilan solishtiradi.

---

## 4. Tekshiruvda topilgan va tuzatilgan xato

Tergovchi kabinetida yo'naltiruvchi savol uchun JPK 114-moddasiga havola berilgan edi. To'g'risi **JPK 102-modda**: "Ishora qiluvchi savollar berishga yo'l qo'yilmasligi". 114-modda so'roq tartibi va advokat arzi haqida. Tuzatildi.

Koddagi har bir "N-modda" havolasi lex.uz to'plami bilan avtomatik test qilinadi (`src/data/sources.test.ts`).

---

## 5. Manbalar

Ochib o'qilgan manbalar:
- Barton, McKellar & Maharg, "Authentic Fictions: Simulation, Professionalism and Legal Learning", 14 *Clinical Law Review* 143 (2007). https://openresearch-repository.anu.edu.au (ANU)
- Stuckey et al., *Best Practices for Legal Education* (CLEA, 2007), 5-bob. https://www.cleaweb.org/s/best_practices-05.pdf
- Errington, "Preparing Graduates for the Professions..." (2010). https://researchonline.jcu.edu.au/14960/
- Errington, "Being There: ... Near-World Scenarios" (2009). https://researchonline.jcu.edu.au/8601/
- Haig & Addison, "TrendSpotters: The Scenario-Based Learning Model" (2009) - Ruth Clark modeli bayoni.
- Antonopoulos & Madhloom, Bristol Law Research Paper No. 1 (2020) - Kolb va Schön huquqiy klinik ta'limda.
- Wegner, "The Carnegie Foundation's Educating Lawyers..." *The Bar Examiner* (2011).
- University of Edinburgh Reflection Toolkit: "What? So what? Now what?". https://reflection.ed.ac.uk

Ochib bo'lmagan manbalar:
- Clark'ning *Scenario-Based e-Learning* kitobi (2013): "fading" haqidagi fikr faqat ikkilamchi manbadan olingan.
- Carnegie hisobotining o'zi va Kolb (1984): ikkilamchi manbalar orqali.

Huquqiy matnlar: lex.uz, `legal/sources` to'plami (`/manbalar` sahifasi).
