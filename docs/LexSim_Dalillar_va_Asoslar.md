# LexSim: qarorlarimizning huquqiy asoslari, dalillari va raqamlari

**Kim uchun:** soha mutaxassislari (advokatlar, sudyalar, yuridik fakultet o'qituvchilari), hakamlar.
**Sana:** 2026-11-21.
**Qoida:** har bir da'vo yonida manba yoki o'lchov. Tasdiqlanmagan narsa **[TT]** deb belgilangan. Batafsil manbalar `reports/` papkasidagi 7 ta hisobotda.

---

## 0. Qisqacha

LexSim: huquqshunos talabalar uchun virtual amaliyot. Talaba advokat rolida ishlaydi:
- iqtisodiy sud majlisi;
- mijoz bilan maslahat;
- politsiyaga ariza;
- DXM murojaati;
- jamoaviy bahs (moot court);
- o'z casesini kiritish.

Sudya, raqib, kotib va mijozni tizim o'ynaydi. Oxirida talaba **har bir ball nima uchun berilganini** dalil bilan ko'radi.

Uchta asosiy tamoyil:
1. **Qonun matni faqat lex.uz'dan.** Birorta ham modda «xotiradan» olinmaydi.
2. **AI o'ylab topmaydi.** Javob avval tekshirilgan tayyor matndan olinadi. AI faqat tayyor javob bo'lmaganda gapiradi, uning har bir javobini server tekshiradi.
3. **Oxirgi so'z mentorniki.** Tizim, keyin AI, keyin mentor.

---

## 1. Huquqiy manba bazasi: nimaga tayanamiz

### 1.1. Qonunchilik korpusi (RAG bazasi)

Hammasi lex.uz rasmiy matnidan, moddama-modda olingan (2026-11-20/21):

| Hujjat | lex.uz ID | Moddalar (bo'laklar) |
|---|---|---|
| Fuqarolik kodeksi (FK) 1- va 2-qism | 111181, 180550 | 1 196 modda (1 237 bo'lak) |
| Iqtisodiy protsessual kodeks (IPK) | 3523891 | 390 (452) |
| Fuqarolik protsessual kodeksi (FPK) | 3517334 | 513 (555) |
| Mehnat kodeksi (O'RQ-798, 2022), 8¹-modda (13.11.2026) bilan | 6257288 | 594 (714) |
| Jinoyat-protsessual kodeksi (JPK) | 111463 | 773 (954) |
| Jinoyat kodeksi (JK) | 111453 | 406 (448) |
| «Jismoniy va yuridik shaxslarning murojaatlari to'g'risida» (O'RQ-445) | 3336169 | 39 (45) |
| «Davlat boji to'g'risida» (O'RQ-600) | 4680944 | 33 (154) |
| «Advokatura to'g'risida» (349-I) | 54503 | 30 (44) |
| «Advokatlik faoliyatining kafolatlari…» (721-I) | 29626 | 12 (13) |
| Plenum qarorlari: OXS 163, 234, 204, 283; OS 12, 14, 19 va boshq. | lex.uz | bandma-band |

**Jami ~4 800 bo'lak.** Har bo'lakda saqlanadi:
- lex.uz havolasi (moddaning aniq langari);
- olingan sana;
- tahrir izohlari;
- matn xeshi (`content_hash`).x`

Qonun o'zgarsa, faqat o'zgargan moddalar yangilanadi.

**Qidiruv qanday ishlaydi:**
1. `bge-m3` embedding (ma'no bo'yicha) va so'z bo'yicha qidiruv birga ishlaydi.
2. GPU'dagi reranker 30 ta nomzoddan eng mos 5 tasini tanlaydi.
3. Eng yaxshi natija bahosi **< 0,3** bo'lsa, «manba topilmadi» deyiladi va javob to'qilmaydi.

### 1.2. Sud amaliyoti va statistika

**Oliy sud statistikasi, 2025-yil** (stat.sud.uz, `eco-2025-12.xlsx`). Iqtisodiy sudlarda **119 042** ta shartnomaviy nizo ko'rilgan:

| Toifa | Ulush | Ishlar soni |
|---|---|---|
| Yetkazib berish | 24,2 % | 28 776 |
| Kommunal xizmatlar | 19,1 % | |
| Kredit | 12,7 % | |
| Oldi-sotdi | 11,0 % | |
| Pullik xizmatlar | 8,1 % | |
| Ijara | 5,1 % | 6 095 |

Fuqarolik sudlarida mehnat nizolari ishlarning 2,2 % i (14 343 ta).

→ **Shuning uchun** ssenariylar va sohalar shu ulush tartibida tanlanadi. Keyingi ssenariy yetkazib berish bo'ladi, hozirgi ijara emas.

**Haqiqiy ishlar.** 16 ta ish o'rganildi: 9 tasi O'zbekiston va MDH, 7 tasi xalqaro. Ishlarning yarmidan ko'pi ikki masala atrofida:
- neustoykani kamaytirish (FK 326);
- imzolanmagan dalolatnomaning dalil kuchi.

OXS 163, 234 va 306-son Plenumlari bu masalalarda sanab beriladigan qoidalarni belgilaydi. Shu sababli talabani qoida bo'yicha ballash mumkin. Batafsil: `reports/Munozarali iqtisodiy sud ishlari.md`.

**Plenumlar holati.** OXS 163 va 234 sud.uz'ning amaldagi ro'yxatida bor, oxirgi o'zgartirishlari 16.12.2024 va 29.04.2025.

### 1.3. Advokat maqomi va etikasi

| Masala | Manba |
|---|---|
| Advokatning huquq va majburiyatlari | 349-I, 6- va 7-moddalar |
| Advokat so'rovi | 349-I, 7¹-modda. Javob muddati 15 kun. **Order nusxasi** talab qilinmaydi: PQ-263 (30.05.2022, 4-band «v»), 2023-yil 1-fevraldan |
| Advokatlik siri | 349-I, 9-modda |
| Qasamyod, order, «faqat order va guvohnoma talab qilinadi» | 721-I, 3, 4, 7-moddalar; PF-5441 (2018) |
| Etika qoidalari | Advokatlar palatasi, 27.09.2013, 63 band. **[TT]** Rasmiy to'liq matni topilmadi, nrm.uz nusxasi ishlatildi. 2023-yildagi yangi tahrir loyihasi kun tartibidan olib tashlangan |
| Malaka imtihoni | Adliya vazirligining 3637-son Nizomi (07.07.2025): 5 savol, har javob 0–10 ball, o'tish chegarasi **60 %**. Rubrikasi yo'q |
| Sudga hurmatsizlik | MJtK 180-modda, 1–3 BHM |

---

## 2. Sud majlisi: har bir qadamning moddasi

Tizimdagi sudya majlisni IPK tartibida olib boradi. Har bir sudya gapi IPK moddasiga bog'langan va bu moddalar korpus bilan avtomatik solishtirilgan: **hammasi mavjud, sarlavhalari mos**.

| Bosqich / xatti-harakat | Asos |
|---|---|
| Vakolatni tekshirish; hujjatsiz vakil majlisga qo'yilmaydi | IPK 62 |
| Rad qilish; rad mazmun ko'rilishidan oldin bildiriladi, kech radga faqat asos keyin ma'lum bo'lsa | IPK 20–23 (22-modda) |
| «Hurmatli sud!» murojaati; tartib buzilsa avval ogohlantirish, keyin zaldan chiqarish | IPK 167 |
| Dalillar tekshiriladi; faqat oshkor qilingan dalilga tayaniladi | IPK 68, 168 |
| Iltimosnomalar ajrim bilan hal qilinadi | IPK 169 |
| Muzokarada tekshirilmagan dalilga tayanib bo'lmaydi | IPK 173, 5-qism |
| Qaror, kuchga kirishi va apellyatsiya muddati (1 oy) | IPK 179, 186, 192, **262** |
| Neustoykani kamaytirish, quyi chegara | FK 326, 327; OXS 163-son Plenum, 4-band |
| Dalolatnoma tuzish ijaraga beruvchining burchi | FK 541(2), FK 578 (bino), OXS 234-son Plenum, 9-band |

**Tekshiruvda topilib tuzatilgan xatolar:**
1. Apellyatsiya muddati IPK 192 ga bog'langan edi. To'g'risi **IPK 262**.
2. «FK 541 o'rniga FK 578» degan oldingi maslahatimiz noto'g'ri bo'lib chiqdi. To'g'risi: uchala asos birga (FK 541(2), FK 578, OXS234-p9).
3. Iqtisodiy ishda FPK moddalari keltirilgan joy topildi.
4. «Pretenziya hamma B2B nizolarda majburiy» degan fikr noto'g'ri. U faqat qonun yoki shartnomada nazarda tutilgan bo'lsa majburiy (IPK 107-modda, 5-band; 670-I qonun, 17-modda).
5. Mehnat ishlarida apellyatsiya muddati **FPK 385¹** da, FPK 385 da emas.

**Ochiq:** ijara ishidagi penyaning 3 040 580 so'mdan 30 405 so'mga (aniq 1 %) kamaytirilgani OXS 163-4 dagi quyi chegaraga to'g'ri kelmaydi **[TT]**. Mentor asl qarorni ko'rishi kerak. Davlat boji (573 220,27 so'm) esa to'liq da'voning aniq 2 % iga teng, bu IPK 118(6) ga mos.

---

## 3. Hujjat tuzish: rekvizitlar va davlat boji

| Hujjat | Majburiy rekvizitlar | Xato bo'lsa |
|---|---|---|
| Iqtisodiy sudga da'vo | IPK 149 (9 band + imzo), 151 (ilovalar) | Qaytariladi (IPK 155) yoki ko'rmasdan qoldiriladi (IPK 107) |
| Fuqarolik sudiga da'vo | FPK 189, 191 | Qaytariladi (FPK 195) |
| Jinoyat haqida ariza | JPK 322–324; anonim xabar asos bo'lmaydi (JPK 323); 10 kun, 1 oygacha uzaytiriladi (JPK 329) | Qabul qilinmaydi |
| Davlat organiga murojaat | O'RQ-445, 6-modda; 15 kun, 1 oygacha (28-modda) | Ko'rib chiqilmaydi (29-modda) |

**Davlat boji (O'RQ-600):**
- iqtisodiy sudda 2 %, fuqarolik sudida 4 %;
- kamida 1 BHM, yuqori chegara yo'q;
- kichik biznes iqtisodiy sudda 50 % to'laydi, mehnat da'volari bojdan ozod (8-modda, 1-band).

**BHM:** 2026-yil 1-sentabrdan **440 000 so'm** (PF-115, 23.06.2026). Undan oldin 412 000 so'm edi.

---

## 4. Baholash: ball nimaga asoslanadi

### 4.1. Tashqi standartlar (nega aynan shular)

| Standart | Nimani oldik | Manba |
|---|---|---|
| **Jessup 2025** (xalqaro moot, ILSA) | huquq 30, savollarga javob 25, faktlar 20, uslub 15, tashkil etish 10 | ILSA Oral Rounds Scoresheet 2025 |
| **SQE2** (Angliya advokatlik imtihoni, 2026-09-01 dan) | har mezon A–F → 0–5; ko'nikma va huquq **50/50**; etika alohida mezon | SRA specification |
| **Vis Moot, 33-tanlov** | ballar oralig'i: 60–69 qoniqarli … 91–100 a'lo; ona tili xatosi uchun ball kesilmaydi | Vis arbitrator instructions 2026 |
| **3637-son Nizom** (O'zbekiston) | o'tish chegarasi 60 % | lex.uz/docs/7619714 |

### 4.2. Bahs mezonlari og'irligi

| Mezon | Og'irlik | Asos |
|---|---|---|
| Huquqiy asos | 30 | Jessup: huquq 30; SQE2: huquq baholashning yarmi |
| Raqibga javob | 25 | Jessup: savollarga javob 25; Berkeley: savollar 35 |
| Faktlar va dalillar | 20 | Jessup: faktlar 20; IPK 68 |
| So'zdan foydalanish | 15 | Vis: tayyorgarlik; Berkeley: kirish va yakun |
| Sud odobi | 10 | IPK 167; etika qoidalari 55-band |

**Jessup'dan bitta farq.** Uslub va tashkil etish o'rin almashtirilgan. Sabab: AI nutqning yozma bayonnomasini (STT) o'qiydi, ovoz ohangi va ko'z aloqasini ko'rmaydi. O'zbek STT xatosi esa 8–25 %.

**Rad etilgan variant.** Frontend dastlab «faktlar 30, huquq 15» jadvalini taklif qilgan edi. Bunday jadval hech bir haqiqiy moot baholash varaqasida yo'q.

**Sud zali.** Hozirgi og'irliklar (30/15/15/15/15/10) manbasiz. Metodikada SQE2 50/50 asosida taklif bor: huquq 25, protsess 15, etika 10, faktlar 20, muloqot 20, hujjat 10. Bu **hali qo'llanmagan**.

### 4.3. «AI + qoida»: ballni kim beradi

1. **Qoida (AI'siz):** «Hurmatli sud» murojaati, so'kinish, manbasiz modda, har so'zda gapirgani.
2. **AI:** faqat 17 ta aniq savolga «ha» yoki «yo'q» deydi va har «ha» uchun **talabaning o'z gapidan iqtibos** keltiradi.
3. **Server:**
   - iqtibosni bayonnomadan qidiradi (moslik ≥ 0,85). Topilmasa, ball berilmaydi va ish mentorga ketadi;
   - ballni hisoblaydi: bajarilgan bandlar og'irligi ÷ musbat og'irliklar yig'indisi × mezon maksimumi;
   - so'kinsa, jami ball 40 dan oshmaydi (etika chegarasi).

**Nega AI'ga ball qo'ydirmaymiz.** Tadqiqotlarda AI baholovchining xatolari aniq:
- har xil modellarning qattiqqo'lligi shkalaning 15–33 % iga farq qiladi;
- model versiyasi o'zgarsa, baho 1000 balldan 133 tagacha siljiydi;
- norasmiy uslubdagi javobni jazolaydi.

Atomar bandlar va dalil talab qilish bu xatolarni kamaytiradi. LexRubric tadqiqoti (arXiv 2606.09389): AI hakam va 3 ekspert o'rtasidagi kelishuv κ = 0,589, xom kelishuv 79,4 %.

### 4.4. AI qanchalik ishonchli: o'lchov rejasi

**Xalqaro dalil.** GradeLegal tadqiqoti (arXiv 2605.21076, nemis huquq imtihonlari) AI va ekspert bahosi kelishuvini (QWK) o'lchagan:

| Soha | Rubrikasiz | Rubrika va namuna yechim bilan |
|---|---|---|
| Ommaviy huquq | 0,58 | **0,91** |
| Jinoyat huquqi | 0,309 | 0,60 |

Uzun javoblarda AI eng ko'p adashadi.

**Xulosa:** AI bahosi hozircha **mashq va fikr-mulohaza** uchun.

**Bizda tasdiqlash qanday bo'ladi** (uch bosqich, `jamiyat_fikri` loyihasidagi modeldan moslangan):
1. AI shubhali ishni mentorga o'zi yuboradi: iqtibos topilmasa, yurishlar kelishmasa, etika buzilsa.
2. AI «yaxshi» degan ishlarning **3 %** i tasodifiy auditga tushadi.
3. Mentor qarorlari «oltin to'plam»ga yig'iladi va AI bilan kelishuv o'lchanadi.

Rasmiy bahoga o'tish uchun maqsad: **Koen kappasi ≥ 0,61** (Landis–Koch bo'yicha «sezilarli» daraja). 30–50 ta ishni ikki mentor baholashi kerak.

---

## 5. AI xavfsizligi: javob berish tartibi

| # | Kim javob beradi |
|---|---|
| 1 | Qoidalar: so'kinish, rolni buzishga urinish, murojaat |
| 2 | Tanish vaziyatlar: «ishonchnoma uyda qoldi», «qaytaring», ruscha gap |
| 3 | Talaba tashabbusi: iltimosnoma, guvoh, e'tiroz |
| 4 | Ssenariy va bank (ma'no bo'yicha moslash) |
| 5 | **AI**, faqat yuqoridagilar mos kelmasa |
| 6 | Tayyor zaxira gap, agar AI ishlamasa yoki tekshiruvdan o'tmasa |

**AI javobini server tekshiradi:**
- yangi raqam yoki sana yo'q (faqat ish faktlari va talaba gapidagi raqamlar);
- modda faqat ruxsat etilgan ro'yxatdan;
- 1–3 gap, kirill va so'kinish yo'q;
- qaror chiqarmaydi.

Tekshiruvdan o'tmagan javob **tashlanadi**.

**O'lchov.** Sud zalida javoblarning ~93 % i ssenariy, ~6 % i bank, ~0,1 % i AI. Ya'ni sud majlisining deyarli hammasi tekshirilgan matn.

**Shaxsiy ma'lumot.** Telefon, pasport, JSHSHIR, karta, e-pochta va Telegram username AI'ga yuborilishidan **oldin** yashiriladi. Logga talabaning matni yozilmaydi. Saqlash muddati: majlis 7 kun, case 180 kun.

---

## 6. Psixologik taktikalar (AI raqib uchun)

60 ta usul kartasi tuzilgan. Har kartada: misol, qaysi bosqichda ishlatiladi, belgilari, to'g'ri javob, odatiy xato va etika chegarasi.

Asosiy dalillar:
- Irving Younger'ning so'roqdagi 10 qoidasi;
- **«Langar» effekti**: 13 yillik tajribali sudyalar ham tasodifiy raqamga bog'lanib qolgan (Englich, 2006);
- Harvard PON muzokara qarshi choralari.

Har usul belgilangan: qonuniy, faqat «e'tiroz mashqi» rejimida yoki taqiqlangan (yolg'on, soxta dalil, sudni chalg'itish). Batafsil: `reports/Sud jarayonidagi psixologik taktikalar.md`.

---

## 7. Texnik o'lchovlar (raqamlar bilan)

| Nima | Natija | Izoh |
|---|---|---|
| STT xatosi (WER), qisqa gaplar | 13 % → **7,8 %** | Kotib modeli, atama tuzatishlari bilan. 10 ta ma'lum matnli audio (sintetik ovoz) |
| STT, rubaistt_v2 | 26 % | Shu sababli Kotib tanlandi |
| STT, uzun nutq | avval 15 s da kesilardi → endi 60 s gacha, bo'laklab | 26–31 s lik gap to'liq tanildi |
| STT tezligi | ~2,2 s / gap | Model almashtirish ~20 s, shuning uchun bitta model ishlatiladi |
| STT, sonlar | «besh yuz qirq to'rtinchi moddasiga» → «544-moddasiga» | 11/11 test |
| RAG qidiruvi | ~0,9 s; rerankersiz Recall ~0,88 | |
| LLM tanlovi (o'zbek tili, UzLiB testi) | API modellar 0,78–0,85; 8 GB GPU'ga sig'adigan modellar 0,34–0,47 (tasodif 0,25) | Shuning uchun mahalliy LLM rad etildi |
| AI sudya va qahramon javobi | 9–13 s (AIHUB), birinchi chaqiruv ~50 s | Tez API bilan 2–4 s kutiladi **[TT]** |
| Avtomatik testlar | **103 ta**, hammasi o'tadi | Har o'rnatishdan oldin |
| Ovozlar | 424 / 424 gap oldindan yozilgan | |
| Server javobi (`/health`) | 40–75 ms | |
| Mustaqil kod tekshiruvi | 18 ta topilma, jiddiylari tuzatildi | |

---

## 8. Qaysi manbalar ishlatilmaydi va nega

| Sayt | Qaror | Sabab |
|---|---|---|
| lex.uz, sud.uz, stat.sud.uz | ✅ asosiy manba | Rasmiy |
| tergov.uz | ✅ qayta yozib, havola bilan | 11 ta rasmiy savol-javob, o'g'irlik yo'li uchun |
| prokuratura.uz | ✅ statistika | 2026-yil yanvar–oktabr: ko'rib chiqilgan murojaatlarning ~31 % ida huquq tiklangan |
| advice.uz (Madad NNT) | ⚠️ faqat qayta yozib, havola bilan | Litsenziya yo'q. Hamkorlik memorandumi tavsiya qilinadi |
| norma.uz / nrm.uz | ❌ matni olinmaydi | Yozma kelishuvsiz ko'chirish taqiqlangan |
| AdvokatPro | ❌ faqat g'oya | Xususiy startap, kontenti mualliflik huquqi bilan himoyalangan |
| sjco.uz | ❌ faqat ma'lumotnoma | Operatori noaniq, reklama bor |
| advokat.uz | ❌ | Sayt ishlamaydi |

---

## 9. Ochiq aytadigan cheklovlar

1. **Ssenariylarni yurist rasman tasdiqlamagan** (`mentorApproved: false`). Moddalar mashina tomonidan tekshirilgan, mazmunni mentor ko'rishi kerak.
2. **AI bahosi hali mentorlar bilan solishtirilmagan.** Navbat tayyor, mentorlar kerak.
3. **Etika qoidalarining rasmiy to'liq matni** Advokatlar palatasidan so'ralishi kerak.
4. **STT haqiqiy talaba ovozida sinalmagan**, faqat sintetik ovozda. 10–20 ta haqiqiy yozuv kerak.
5. **Sud zali og'irliklari** hali manbali jadvalga o'tkazilmagan.
6. **Meta MMS** (zaxira ovoz) litsenziyasi CC-BY-NC, tijoriy foydalanish mumkin emas. Kotib va o'zbekcha Chatterbox litsenziyasi tekshirilishi kerak.
7. **AI javobi sekin** (AIHUB). Rasmiy API kaliti kerak.

---

## 10. Mutaxassis beradigan savollar

**«Moddalaringiz to'g'ri ekaniga kafolat bormi?»**
Har modda lex.uz'dagi rasmiy matnning nusxasi va havolasi bilan saqlanadi. Ssenariydagi barcha moddalar korpus bilan avtomatik solishtirilgan. Tekshiruvda 5 ta xato topilib tuzatildi (2-bo'lim). Yakuniy tasdiq mentorniki.

**«Nega aynan shu ish turlari?»**
Oliy sud statistikasi bo'yicha (2025): yetkazib berish 24,2 %, kommunal 19,1 %, kredit 12,7 %.

**«Ball qanday standartga asoslangan?»**
Jessup va Vis moot'lari, SQE2 advokatlik imtihoni hamda Adliya vazirligining 3637-son Nizomi. Har ball yonida mezon, manba va talabaning o'z gapi ko'rsatiladi.

**«AI bahosiga ishonsa bo'ladimi?»**
Hozircha faqat mashq uchun. Rasmiy bahoga AI va mentor kelishuvi κ ≥ 0,61 ga yetgach o'tiladi. Bu o'lchov tizimga qurilgan.

**«Talaba noto'g'ri yo'l tutsa, tizim nima qiladi?»**
Sudya IPK tartibida munosabat bildiradi: tanbeh, qayta so'rash, ajrim, zaldan chiqarish. Hisobotda nima xato bo'lgani, qaysi modda va to'g'ri javob qanday ekani ko'rsatiladi.

**«Shaxsiy ma'lumot himoyasi?»**
Talaba xesh orqali aniqlanadi. Shaxsiy raqamlar AI'ga yuborilishidan oldin yashiriladi. Log matnsiz yoziladi. Ma'lumot muddat o'tgach avtomatik o'chiriladi.

---

## Manba hisobotlar

| Hisobot | Mavzu |
|---|---|
| `reports/Munozarali iqtisodiy sud ishlari.md` | 16 ta haqiqiy ish |
| `reports/Sud jarayonidagi psixologik taktikalar.md` | 60 ta usul kartasi |
| `reports/LexSim manbalar asosi.md` | manba ierarxiyasi, xatolar, hujjat tuzish |
| `reports/LexSim qoshimcha manbalar.md` | tergov.uz, prokuratura.uz, advice.uz va boshqalar |
| `reports/LexSim baholash metodikasi.md` | standartlar, protokol, validatsiya |
| `reports/LexSim tekshiruv va yechimlar.md` | [TT] larni tekshirish, LLM va STT tanlovi |
| `LexSim_Texnik_Tushuntirish.md` | texnik tuzilma va savol-javob |
