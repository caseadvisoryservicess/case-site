# 07 · Узбекский корпус и данные для транслитератора (ТЗ §7.2)

Источники (только эти два файла, ничего больше не использовалось):

- `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/CASE Tijorat Taklifi A4.dc.html` - 616 строк, дальше обозначается `A4:<строка>`
- `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/CASE Taklif Prezentatsiya.dc.html` - 651 строка, дальше обозначается `DECK:<строка>`

ТЗ, на которое ссылается задание:
`/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/prompts/CASE-OS-Offer-Builder-prompt.md`
- §7.1 «Uzbek must be fully Uzbek» (строки 263-297), §7.2 «Latin ⇄ Cyrillic switching» (строки 299-314).

## Метод извлечения

Оба файла разобраны HTML-парсером. В корпус попал текст из:

- текстовых узлов вне `<style>` и `<script>`;
- атрибутов `alt`, `placeholder`, `data-screen-label`, `data-label`, `data-speaker-notes`.

`data-speaker-notes` (15 штук, только в DECK) - это полноценный узбекский текст, который тоже пойдёт
в экспорт PPTX, поэтому он включён в корпус. Содержимое `<style>`, `<script>`,
`data-props` (JSON настроек редактора), CSS-атрибута `style` - исключено.

Всего извлечено 797 текстовых фрагментов (A4 - 382, DECK - 415) и **996 уникальных словоформ
с учётом регистра** (897 без учёта регистра). Регистр сохранён намеренно: `Bo‘lim` и `bo‘lim`,
`Sh` и `sh`, `TAVSIYA` и `tavsiya` - разные тест-кейсы для диграфов и для `o‘`.

Разбивка:

| Категория | Кол-во | Где |
|---|---|---|
| Узбекские словоформы (корпус для property-теста) | **926** | §1 |
| Латинские бренды / английские слова / части URL и e-mail | **57** | §2 |
| Аббревиатуры и одиночные буквы (спорные) | **13** | §2.6 |

Сортировка - по строке в нижнем регистре. Типографский апостроф U+2018 (`‘`) в кодовой таблице
идёт после `z`, поэтому формы с `o‘`/`g‘` стоят после форм на `oz`/`gz` - это совпадает
с узбекской традицией (`o‘` после `o`, `g‘` после `g`).

---

## 1. Корпус узбекских словоформ (926 уникальных)

Выписано дословно, посимвольно. Все `o‘`/`g‘` и тутук белгиси - реальный U+2018,
как в файлах. Ничего не нормализовано.

Это множество и есть вход для property-теста `toLatn(toCyrl(x)) === x`.

**A** (44)

```
aktivga  Aktivni  albatta  Alohida  alohida  aloqa
aloqalari  amal  amalga  analitik  aniq  aniqlash
aniqlashtiriladi  aniqlaydi  aniqligi  aniqroq  arxitektor  Arxitektorlar
Arxitektura  arzon  aslida  asos  Asoschi  asosda
asosi  asosida  asosini  Asosiy  asosiy  asoslangan
asoslash  asosni  auditoriya  Avtoturargoh  avtoturargoh  avtoturargohi
aylanadi  aylantiramiz  Aynan  aytamiz  aytib  aytiladigan
aytish  Aziz
```

**B** (100)

```
baholash  baholaydi  baholaymiz  baholovi  baholovini  bajariladi
Bajariladigan  bajarmaguncha  band  barcha  barqaror  barqarorligini
bartaraf  Batafsil  bazamiz  bazasi  Bekor  bekor
belgilanadi  belgilaydi  beradi  bering  berish  berishimiz
bermaydi  Beshta  bilan  bildiramiz  bildirganingiz  bilim
Bir  bir  biri  birinchi  Biz  biz
Bizga  bizning  blok  Bloklar  bloklari  Bo'lim
bog‘langan  bog‘liq  bog‘lovchi  boramiz  borish  Bosh
boshlanadi  Boshlang‘ich  boshlang‘ich  boshlanishida  boshlash  boshqa
boshqarish  Boshqaruv  boshqaruv  boshqaruvchi  bosma  Bosqich
bosqich  bosqichga  bosqichi  bosqichida  bosqichidagi  Bosqichlar
bosqichlarda  bosqichlari  Bozor  bozor  bozorda  bozordagi
bo‘g‘in  bo‘ladigan  bo‘lganda  Bo‘lim  bo‘lim  bo‘limi
bo‘lishi  bo‘lmagan  bo‘lmasa  bo‘lsa  bo‘lsagina  bo‘yicha
brend  Bu  bu  bugun  Bugungi  bugungi
bunga  Buyurtmachi  buyurtmachi  Buyurtmachining  buyuruvchi  buyuruvchilar
buzilishlarni  buzilmasligini  byudjet  byudjeti
```

**C** (13)

```
chegaralari  cheklovlar  cheklovlari  chiqarib  chiqiladi  chiqish
chiqishdan  chiqishni  chiqmang  chizma  chizmalar  Chizmalarni
chuqurligi
```

**D** (21)

```
da  dagi  dan  darajasi  darajasida  Daromad
daromad  daromadi  daromadini  daromadni  davlat  davomida
Demografiya  Diagramma  dinamikasi  dinamikasini  direktor  doimiy
doirasidagi  dollarida  Dushanbe
```

**E** (12)

```
Ekspert  ekspertizani  emas  energiya  Eng  eng
esa  eskiz  Eslatma  etilgan  etilmaguncha  etish
```

**F** (15)

```
faktik  Faqat  faqat  farqini  faylidan  fikr
fondi  Format  formatini  Formulani  foto  foydalanamiz
foydalanish  funksional  funksiyali
```

**G** (8)

```
galereya  galereyasi  gap  gapiramiz  geodeziya  gorizont
gorizontda  g‘oyadan
```

**H** (37)

```
hafta  haftalik  Hajm  hajm  hajmda  hajmi
hajmining  hajmni  Hal  hal  hamda  hamkor
hamkorlik  Hamkorlikka  hamrohligi  Hamrohlik  haqida  Har
har  Hisob  hisob  hisobga  hisobi  hisobimizdan
hisoblanadi  hisobot  hisoboti  Hokimiyat  holatga  holati
hozirgi  hududini  hududni  hujjatlar  huquqini  Hurmat
Hurmatli
```

**I** (38)

```
ichiga  ichki  Ijara  ijara  Ijarachi  ijarachilar
Ijarachilarni  ijaraga  ijaraning  Ijrochi  Ikki  ikki
ilova  imkon  Imzo  imzolash  Individual  Investitsiya
investitsiya  investor  iqtisodiy  Ish  ish  ishchi
Ishga  ishga  ishlab  ishlanish  ishlar  ishlaydi
ishlayotgan  Ishni  ishtirokchilar  Istalgan  istalgan  iste‘molchi
ixtisoslashgan  izohni
```

**J** (13)

```
Jadval  jadvali  Jalb  jalb  jamoa  jamoat
jihatdan  joriy  joy  joylashgan  joylashtirish  Joylashuv
jumladan
```

**K** (68)

```
kafolatlanmagan  kamaytirish  kechish  keladi  keladigan  kelgan
kelgusi  kelishiladi  kelishish  kelishishni  Kelishuv  kelishuv
kelishuvlar  kelishuvlarni  kelishuvning  keltiradigan  keltirilgan  keltirish
kerak  kesimlar  ket  ketma  keyin  Keyingi
keyingi  keyingisi  keyingisining  kifoya  kimmiz  Kiradi
kiradi  Kirish  kirish  kirishini  kiritilmagan  kiritish
Kirmaydi  kirmaydi  kitob  kitobi  kitoblar  kitoblarning
kodlangan  Kompaniya  kompaniyasi  konsalting  konsaltingi  Konsepsiya
konsepsiya  Konsepsiyaning  konsepsiyaning  konsepsiyasi  ko‘chmas  ko‘ngilochar
ko‘p  ko‘ra  ko‘radi  ko‘rib  ko‘rsatamiz  ko‘rsatilgan
ko‘rsatilish  ko‘rsatkichlari  kuchga  kun  kundan  kutish
kuzatib  kvadrat
```

**L** (25)

```
Langar  langar  Lavozimi  lift  liftlari  likvid
likvidligini  Limitdan  limiti  limitlari  Loyiha  loyiha
Loyihaga  loyihaga  loyihalar  loyihalarda  loyihalarni  Loyihalash
loyihalash  Loyihalashdan  loyihalashdan  Loyihani  loyihani  Loyihaning
loyihaning
```

**M** (88)

```
Ma'lumotlar  mahalliy  majburiyatlar  majburiyatlarini  majburiyatni  majmua
majmuaning  majmuasi  majmuasining  Makroiqtisodiy  mamlakat  manfaatlariga
mantig‘i  mantig‘iga  mantig‘ining  mantiq  Maqsad  maqsad
maqsadi  Maqsadli  maqsadli  Marg‘ilon  markazi  Markaziy
marketing  marta  martagacha  masalan  maslahat  maslahatchi
maslahatdan  maslahatlarini  mas‘ul  materiallarida  Mavjud  mavjud
Mavzu  maydon  maydoni  maydonini  maydonlar  maydonlardan
maydonlari  ma‘lumotini  Ma‘lumotlar  ma‘lumotlar  ma‘lumotlarning  ma‘lumotni
mehmonxona  merchandayzing  mijoz  Mijozdan  Mijozga  mijozning
Minimal  minnatdorchilik  mln  mlrd  model  modeli
moliya  Moliyaviy  moliyaviy  moslashtirilishi  moslashtirishga  Moslashuvchan
mosligini  mo‘ljallari  Mualliflik  Muddat  muddat  muddati
Muddatlar  muddatlar  muhim  muhiti  muhitini  muhokamadan
muhr  mulk  mulkdor  mulkdorning  mulkiga  mulkni
mumkin  Muqova  muvofiq  muvofiqligini
```

**N** (26)

```
Narx  narx  narxi  narxning  narxsiz  Natija
natija  Natijalar  natijalar  natijalarini  natijasini  navigatsiya
navo  Nazorat  nazorati  necha  ni  nima
nimadan  nishalari  nishalarini  nomi  nomlab  nomlar
nomlarini  nuqtalarini
```

**O** (65)

```
ob‘ekt  ob‘ektgacha  ob‘ektni  Ochilishga  Offline  og‘zaki
oladi  oldin  oldingi  oldingisining  olib  olinadi
olish  olmaydi  omborlar  Ommaviylik  Online  online
operatsion  optimal  oqimi  oqimini  Oqimlar  oqimlar
Oraliq  Orientir  orientir  ortiq  oshiriladi  Osiyoda
osti  ovoz  ovqatlanish  oxirgi  oy  Oylik
oylik  o‘chiring  o‘lchamlari  o‘lchaymiz  o‘lchov  o‘n
o‘qib  o‘qiydigan  o‘rganish  o‘rni  o‘rnini  o‘rtacha
o‘stirish  o‘tamiz  o‘tish  o‘tkazamiz  o‘tkaziladi  o‘xshash
o‘z  o‘zagi  o‘zaro  O‘zbekiston  O‘zgarishlar  o‘zgarishlar
o‘zgarmas  o‘zgarsa  o‘zgartirmang  o‘zidan  o‘ziga
```

**P** (7)

```
portfel  Potensial  predmeti  predmetini  prognoz  programmasi
pulga
```

**Q** (53)

```
qabul  qadamlar  qadamni  qadar  qamrab  qancha
qanday  qaror  qarori  qarorlar  qator  qatorli
qatorni  qat‘iylashtiriladi  Qavat  qavat  Qavatlar  qavsdagi
qayta  qaytish  qaytishgacha  qiladi  qiladigan  qilamiz
qilinadi  qilinadigan  qilinishi  qilinmaydi  qilish  qilmaymiz
qimmatli  qism  qismi  qismining  qiymat  qiziqish
qog‘ozdagi  qoidalar  qoidasi  qoidasini  qoladi  qoplanadi
qoplanish  qo‘riqlash  qo‘shiladi  qo‘shimcha  qo‘shishdan  qo‘yiladi
quriladi  qurilish  qurish  Quyida  quyidagilar
```

**R** (16)

```
Rangli  rangli  Raqamlarni  raqobat  raqobatchilar  Raqobatchilarning
reja  rejada  rejalar  rejalari  rejalashtirilgan  Rejani
rentabellik  risklar  ro‘yxat  ro‘yxati
```

**S** (56)

```
sababli  safar  sahifada  salohiyatiga  samaradorlik  samaradorlikni
samarali  Sana  sana  saqlab  Savdo  savdo
savol  Sezgirlik  sezgirlik  Shahar  shahar  Shaharsozlik
shaklda  sharh  shart  Shartlar  shartlar  Shartnoma
shartnoma  shartnomaga  shaxs  shaxtalari  Shermuhamedov  shu
shundan  shunga  shuning  sifatida  slayd  slaydda
slaydga  slaydlarda  soat  soatgacha  sof  Soliqlar
soliqlarni  solishtirib  so‘ng  so‘zlari  sponsorlik  stavka
Stavkalar  stavkasi  stilobatga  stilobati  summa  summalar
supermarket  sxemasi
```

**T** (122)

```
Tadqiqot  tadqiqot  tadqiqoti  tahlil  tahlili  tahlilimiz
Tajriba  tajriba  Tajribamizdan  tajribamizdan  tajribamizga  tajribasi
Taklif  taklif  taklifi  taklifni  taklifning  Talab
talab  talablarini  Tanlangan  tanlangan  tanlash  taqdim
taqdimot  taqsimoti  Tarif  tarif  tarifga  tarifi
tarifida  Tariflar  tariflari  Tarifni  Tarkib  tarkib
Tarkibi  tarkibi  tartibi  tartibimiz  tasdig‘i  tasdiq
tasdiqlanadi  tasdiqlangan  tasdiqlangandan  tasdiqlanmagan  Tasdiqlash  tasdiqlash
tashkil  tashlang  tashqaridagi  Tashrif  tashrif  tashrifdan
tashriflar  tasvirlaridan  TAVSIYA  tavsiya  tavsiyalar  tavsiyalari
tavsiyalarni  taxmin  taxminiy  tayinlaydi  tayyorgarlik  tayyorlanadi
tayyorlash  tayyormiz  ta‘minlaydi  ta‘sir  tegishli  tekshiramiz
tekshiring  tekshirish  tekshiruvi  tendensiyalari  Texnik  texnik
tezligiga  Tijorat  tijorat  tijoratlashtirish  tili  To'lov
Tojikiston  tomon  tomonidan  tomonlama  tomonlar  topadi
Topografik  topshiriladi  topshirilganda  topshirilgandan  topshiriq  topshiriqlar
Toshkent  Toshkentdan  tozalash  to‘g‘ri  to‘ldiriladi  to‘ldirilganligi
To‘liq  to‘liq  to‘liqligi  To‘lov  to‘lov  to‘lovlarni
to‘playmiz  To‘rt  to‘rt  Transport  transport  tug‘diradigan
tuman  Turar  turar  tushirish  tushunish  tushunishimiz
tuzish  tuzmaslikni
```

**U** (18)

```
Uch  uch  uchastka  uchinchi  uchrashuv  uchrashuvi
uchrashuvlar  Uchta  uchta  uchun  ular  ularni
umumiy  uni  uning  Ushbu  ustunlik  ustuvor
```

**V** (16)

```
va  vakili  vakillari  vakilni  vakolatli  vaqt
vaqtga  vaqti  variant  Vazifa  vazifa  vazifalariga
vazifasi  vazifasini  versiya  voz
```

**X** (18)

```
xabar  xarajat  xarajati  xarajatlari  Xarajatlarni  Xat
xati  Xizmat  xizmat  Xizmatlar  xizmatlar  xizmatlari
xizmatlariga  xodim  xollari  xonalar  xos  Xulosa
```

**Y** (34)

```
Yakka  Yakun  Yakuniy  yakuniy  yangi  yarmi
yaroqli  yechimlari  yer  yerda  Yetishmayotgan  yig‘imi
yil  yiliga  yillar  yillik  yoki  yopiladi
yoziladi  yozma  Yo‘l  yo‘l  yo‘laklari  yo‘lga
yo‘li  Yo‘riqnoma  yo‘riqnomalarni  yuborilgan  yuborishdan  yuk
yuragi  Yuridik  yuridik  yuritadigan
```

**Z** (13)

```
zallari  zanjirini  zarur  zarurat  Zaruratga  zaxira
zid  zimmasiga  zinapoya  zinapoyalar  zonalar  zonalashtirish
zonasi
```

---

## 2. Токены, которые НЕЛЬЗЯ транслитерировать

Полный список того, что реально встретилось в двух шаблонах.

### 2.1 Латинские бренды, названия тарифов, английские термины (57 токенов)

Названия тарифов трогать нельзя не только из-за §7.2 - сам шаблон это требует, A4:332:
«Tarif nomlarini o‘zgartirmang: shartnoma va CASE OS shu nomlar bilan bog‘langan.»

| Токен | Вхождения |
|---|---|
| `CASE` | A4:30, A4:79, A4:84, A4:88, A4:168, A4:256, A4:292, A4:332, A4:342, A4:474, A4:538, A4:543, A4:544, A4:545, A4:546, A4:590, DECK:25, DECK:51, DECK:55, DECK:83, DECK:135, DECK:168, DECK:199, DECK:227, DECK:256, DECK:299, DECK:325, DECK:368, DECK:423, DECK:454, DECK:518, DECK:566, DECK:616, DECK:641, DECK:644 |
| `Case` (в «Case Advisory» MChJ) | A4:577 |
| `Real` `Estate` `Advisory` | A4:30, A4:79, A4:84, A4:88, A4:168, A4:256, A4:342, A4:474, A4:538, A4:590, DECK:25, DECK:55, DECK:641, DECK:644 (+ `Advisory` ещё A4:577) |
| `OS` (в «CASE OS») | A4:332 |
| `Excel` | A4:218, A4:232, A4:239, A4:297, A4:332, DECK:192, DECK:238, DECK:266, DECK:273, DECK:330 |
| `PDF` | A4:194, A4:217, A4:218, A4:240, A4:559, DECK:178, DECK:209, DECK:237, DECK:267, DECK:433 |
| `DWG` | A4:217, A4:218, A4:559, DECK:237, DECK:433 |
| `CAD` | A4:287, DECK:320 |
| `Revit` | A4:287, DECK:320 |
| `NOI` | A4:233, DECK:191, DECK:281 |
| `IRR` | A4:233, A4:325, DECK:191, DECK:285, DECK:358 |
| `NPV` | A4:233, A4:325, DECK:191, DECK:289, DECK:358 |
| `GLA` | A4:189, A4:325, A4:495, DECK:218, DECK:358, DECK:541 |
| `OpEx` | A4:231, DECK:191, DECK:274 |
| `USP` | A4:206, DECK:242 |
| `USD` | A4:267, A4:482, A4:487, DECK:466, DECK:478, DECK:483, DECK:488, DECK:493, DECK:526, DECK:531 |
| `SWOT` (в «SWOT-tahlil») | A4:190, DECK:177, DECK:220 |
| `BoH` | A4:413, A4:423, DECK:603, DECK:607 |
| `Expert` `Review` | A4:263, A4:375, DECK:306, DECK:402, DECK:477 |
| `Concept` `Support` | A4:264, A4:379, DECK:307, DECK:406, DECK:452, DECK:482 |
| `Commercial` `Concept` | A4:260, A4:265, A4:325, A4:383, DECK:297, DECK:308, DECK:358, DECK:410, DECK:487 |
| `Full` `Strategy` | A4:266, A4:324, A4:387, A4:391, DECK:309, DECK:357, DECK:366, DECK:414, DECK:418, DECK:492 |
| `Initial` | A4:364, A4:508, DECK:391, DECK:550 |
| `Light` | A4:364, A4:368, A4:508, A4:514, DECK:391, DECK:395, DECK:550, DECK:554 |
| `Draft` | A4:366, A4:438, A4:511, DECK:393, DECK:552, DECK:579 |
| `Final` | A4:368, A4:370, A4:443, A4:514, A4:517, DECK:395, DECK:397, DECK:554, DECK:584 |
| `report` | A4:368, A4:370, A4:443, A4:514, A4:517, DECK:366, DECK:395, DECK:397, DECK:554, DECK:584 |
| `finance` | A4:366, A4:368, A4:438, A4:511, A4:514, DECK:393, DECK:395, DECK:552, DECK:554, DECK:579 |
| `initial` `draft` `final` `light` (строчные, в спикер-нотах) | DECK:366 |
| `Merchandise` / `merchandise` (+ `mix`) | A4:297, A4:325, DECK:330, DECK:358 |
| `tenant` `mix` (в «tenant-mix») | A4:186, DECK:65, DECK:184, DECK:219, DECK:225 |
| `rent` `roll` (в «rent-roll») | A4:232, DECK:273 |
| `catchment` | A4:188, DECK:216 |
| `Margilon` `City` `Mall` (в «Margilon City Mall») | A4:119, A4:121, DECK:110, DECK:112 |
| `Tashkent` `City` `Park` | A4:126, A4:128, DECK:117, DECK:119 |
| `Mall` `Towers` (в «82 Mall / 82 Towers») | A4:133, A4:135, DECK:124, DECK:126 |
| `m` (единица «m²», «USD/m²») | A4:100, A4:122, A4:129, A4:136, A4:267, A4:421, DECK:96, DECK:113, DECK:120, DECK:127, DECK:461, DECK:466, DECK:478, DECK:483, DECK:488, DECK:493 |
| `Tel` (в «Tel. +998…») | A4:72, A4:161, A4:249, A4:335, A4:467, A4:531, A4:591, DECK:642 |
| `support` `caseadvisory` `uz` `com` `www` (части e-mail и URL) | A4:72, A4:161, A4:249, A4:335, A4:467, A4:531, A4:592, DECK:642 |

Обратите внимание: `F` и `B` из `F&B` тоже сюда относятся - см. §2.6, там они смешаны
с узбекскими употреблениями тех же букв.

### 2.2 Единицы измерения

| Токен | Вхождения |
|---|---|
| `m²` | A4:100, A4:122, A4:129, A4:136, A4:267, A4:421, DECK:96, DECK:113, DECK:120, DECK:127, DECK:461 |
| `USD/m²` | DECK:466, DECK:478, DECK:483, DECK:488, DECK:493 |
| `USD/oy` | A4:482, DECK:526 |
| `USD/soat` | A4:487, DECK:531 |
| `$80/soat` | A4:526, DECK:516 |
| `%` (в `40%`, `30%`, `20%`, `50%`) | A4:431, A4:436, A4:441, DECK:501, DECK:505, DECK:509, DECK:572, DECK:577, DECK:582, DECK:609 |
| `$` (отдельным узлом) | DECK:471 |

Хвосты `/oy` и `/soat` - узбекские слова внутри единицы. Правило «не транслитерировать m²»
их не покрывает: `USD/oy` → `USD/oy` или `USD/ой`? Это открытый вопрос, см. §5.

### 2.3 Числа

Полный список числовых токенов, встретившихся в тексте:

```
1  2  3  4  5  6  7  8  9  10  11  12  13  14  15  18  24  30  46  49  50  58  73  75  77  80  82  89
01  02  03  04  05  06  07  08  09
000  047  140  400  500  2017
$5   3D
+1  +2  +3  +4…  +1…+3
−1  −2  −1/−2  −1…−2
2,0  2,2  2,5  4,5
2-3  4-6  7-10  10-14  10-15
20%  30%  40%  50%
40/30/30
+998
```

Отдельные места, где числа сцеплены с текстом и легко испортить транслитерацией:

- `A4:104`, `DECK:100` - `$5` + `mlrd+`
- `A4:108` - `7` + `yil+`
- `A4:122` - `Marg‘ilon, O‘zbekiston · 49 000 m²`
- `A4:141`, `DECK:141` - `tijorat stilobati (+1…+3), turar-joy bloklari, yer osti avtoturargohi (−1…−2)`
- `A4:269` - `[2,2]` - квадратные скобки = «значение не подтверждено» (правило из A4:332)
- `A4:547` - `o‘n (10) kun` - число прописью и цифрой рядом
- `DECK:461` - `18 400` + `m²`
- `DECK:471` - `$` + `46 000`
- `A4:593` - `Taklif amal qilish muddati: yuborilgan kundan 30 kun.`
- Тире внутри диапазонов - U+2013 (`-`), не дефис: `2-3`, `10-15`. Знак минус - U+2212 (`−`), не дефис.

### 2.4 Адреса почты, ссылки, телефон

| Токен | Вхождения |
|---|---|
| `support@caseadvisory.uz` | A4:72, A4:161, A4:249, A4:335, A4:467, A4:531, A4:592, DECK:642 |
| `www.caseadvisory.com` | A4:72, A4:161, A4:249, A4:335, A4:467, A4:531, A4:592, DECK:642 |
| `+998 77 047 73 75` | A4:72, A4:161, A4:249, A4:335, A4:467, A4:531, A4:591, DECK:642 |

Полная строка подвала (A4:72 и ещё 5 раз): `Tel. +998 77 047 73 75  |  support@caseadvisory.uz  |  www.caseadvisory.com`

### 2.5 Плейсхолдеры `{{...}}`

| Плейсхолдер | Файл, строка |
|---|---|
| `{{ red }}` | A4:25 (атрибут `style` элемента `<doc-page>`) |
| `{{ phBg }}` | A4:25 |
| `{{ s }}` | A4:25 |
| `{{ guide }}` | A4:25 |

**В `CASE Taklif Prezentatsiya.dc.html` плейсхолдеров `{{...}}` не найдено вообще** (0 штук).

Все четыре плейсхолдера A4 сидят внутри CSS-строки `style="--red: {{ red }};--ph-bg: {{ phBg }};…"`,
то есть в видимый текст не попадают. Плейсхолдеров типа `{{offer_number}}`, `{{version}}`, `{{date}}`
(они упоминаются в §8 ТЗ) в шаблонах **не найдено**.

Зато содержательные «дырки под заполнение» сделаны не плейсхолдерами, а **узбекским текстом
в кавычках-ёлочках и в подсвеченных span'ах** - их транслитерировать НАДО:
`«Loyiha nomi»` (A4:36, A4:82, A4:141, DECK:31, DECK:140), `Kompaniya nomi` (A4:40, A4:583, DECK:36),
`Shahar, mamlakat` (A4:44, DECK:40), `kun oy yil` (A4:48, DECK:44), `shahar, tuman` (A4:141),
`F.I.Sh.` (A4:83, A4:583), `Lavozimi` (A4:583).

### 2.6 Аббревиатуры и одиночные буквы - спорная зона (13 токенов)

Их нельзя отнести ни туда, ни сюда без решения. Каждую надо явно занести
либо в стоп-лист, либо в тесты.

| Токен | Вхождения | Что это | Предлагаемая кириллица |
|---|---|---|---|
| `A` | A4:55, A4:177, A4:246, A4:577, DECK:175, DECK:197, DECK:200, DECK:204 | буква блока «Bo‘lim A»; ещё инициал в `Shermuhamedov A. A.` (A4:577) | не трогать (индекс блока) |
| `B` | A4:59, A4:142, A4:200, A4:207, A4:246, A4:401, DECK:182, DECK:225, DECK:228, DECK:232, DECK:244, DECK:594 | буква блока «Bo‘lim B» **и** часть `F&B` | не трогать |
| `C` | A4:63, A4:224, A4:246, DECK:189, DECK:254, DECK:257, DECK:261 | буква блока «Bo‘lim C» | не трогать |
| `D` | A4:67, A4:287, DECK:320 | буква тарифа D (A4:67) **и** часть `3D` (A4:287, DECK:320) | не трогать |
| `E` | A4:518 | `E-versiya yoki bosma shaklda` | `Э-версия` (начальная e → э) |
| `F` `I` `Sh` | A4:83, A4:583 | `F.I.Sh.` = Familiya Ism Sharif | `Ф.И.Ш.` - тест регистра диграфа `Sh` → `Ш` |
| `F` `B` | A4:142, A4:207, A4:401, DECK:244, DECK:594 | `F&B` | не трогать |
| `TEA` | A4:36, A4:64, A4:225, DECK:59, DECK:127, DECK:190, DECK:254, DECK:257 | «moliyaviy TEA» (A4:36, A4:64, A4:225, DECK:190, DECK:254, DECK:257) и «Konsepsiya va TEA» (DECK:59, DECK:127) = Texnik-iqtisodiy asoslash | `ТЭА` (внутри аббревиатуры `e` - начальная?) - решить |
| `TT` | DECK:185 | Texnik topshiriq | `ТТ` |
| `TIK` | A4:561, DECK:435 | «Bloklar bo‘yicha TIK» | `ТИК` |
| `MChJ` | A4:577 | «Case Advisory» MChJ | `МЧЖ` - тест: диграф `Ch` в середине аббревиатуры |
| `AQSh` | A4:446, DECK:609 | «Hisob-kitoblar AQSh dollarida» | `АҚШ` - тест: диграф `Sh` в конце, верхний регистр |

---

## 3. Таблица сложных случаев транслитерации (примеры только из этого корпуса)

Кириллица в колонке «Ожидаемая форма» получена механическим применением таблицы §7.2 ТЗ
(`a-а b-б d-д e-е f-ф g-г h-ҳ i-и j-ж k-к l-л m-м n-н o-о p-п q-қ r-р s-с t-т u-у v-в x-х y-й z-з`,
`sh-ш ch-ч ng-нг o‘-ў g‘-ғ ts-ц ’-ъ`). Где механический результат расходится
с обычным написанием - это отмечено отдельно (§3.9 и §5).

### 3.1 Диграф `sh` → `ш`

`sh` в корпусе встречается в **152 словоформах**. Опасность одна: жадность.

| Словоформа | Где | Ожидаемая форма | Чем интересна |
|---|---|---|---|
| `ish` | A4:85, A4:287, A4:459, A4:545, DECK:320, DECK:366, DECK:631 | `иш` | минимальный случай |
| `ishchi` | A4:500 | `ишчи` | **`sh` + `ch` подряд** - единственный такой кластер в корпусе; жадность слева направо обязана дать `ш`+`ч`, а не `с`+`ҳч` |
| `Toshkent` | A4:129, A4:591, DECK:120 | `Тошкент` | `sh` на стыке `tosh`+`kent` |
| `Toshkentdan` | A4:500, DECK:559 | `Тошкентдан` | |
| `sharh` | A4:183, DECK:213 | `шарҳ` | `sh` в начале + одиночное `h` → `ҳ` в конце |
| `o‘xshash` | A4:544, DECK:81 | `ўхшаш` | `o‘` + `x`→`х` + `sh`→`ш` дважды |
| `shaxs` | A4:500, A4:528, DECK:559 | `шахс` | `sh` vs `x` |
| `Shermuhamedov` | A4:87, A4:577, DECK:640 | `Шермуҳамедов` | `Sh` заглавный + `h`→`ҳ` внутри |
| `shaxtalari` | A4:424 | `шахталари` | |
| `Beshta` | A4:550 | `Бешта` | `sh` перед согласной |
| `boshlang‘ich` | A4:391, A4:459, A4:552, DECK:418 | `бошланғич` | `sh` + `ng‘` + `ch` в одном слове - см. §3.3 |
| `Bo'lim` (sic) | DECK:197, DECK:225, DECK:254 | - | **ASCII-апостроф вместо U+2018**, см. §5 |

**Стык морфем `s` + `h` (когда `sh` НЕ диграф) - не найдено.** Во всём корпусе нет ни одного слова,
где `s` заканчивала бы морфему, а `h` начинала следующую. Единственный «страшный» кластер - `ishchi`.

### 3.2 Диграф `ch` → `ч`

`ch` в корпусе - **82 словоформы**.

| Словоформа | Где | Ожидаемая форма | Чем интересна |
|---|---|---|---|
| `chizma` | 15 вхождений: A4:364, A4:366, A4:368, A4:438, A4:508, A4:511, A4:514, DECK:366, DECK:391, DECK:393, DECK:395, DECK:550, DECK:552, DECK:554, DECK:579 | `чизма` | `ch` в начале |
| `uchun` | A4:36, A4:84, A4:85, A4:154 и ещё 17 (21 вхождение) | `учун` | самое частое |
| `bo‘yicha` | A4:68, A4:82, A4:190, A4:208 и ещё 21 (полный список в §3.4) | `бўйича` | `o‘` + `y` + `ch` |
| `Asoschi` | A4:88, A4:577, DECK:641 | `Асосчи` | **`s`+`ch`** - жадность обязана взять `ch`, а не оставить `c` |
| `ko‘chmas` | A4:31, A4:84, DECK:26, DECK:54 | `кўчмас` | |
| `ishchi` | A4:500 | `ишчи` | см. §3.1 |
| `iste‘molchi` | A4:183, DECK:213 | `истеъмолчи` | тутук + `ch` |
| `MChJ` | A4:577 | `МЧЖ` | **диграф `Ch` в верхнем регистре внутри аббревиатуры** |
| `necha` | A4:329, DECK:362 | `неча` | |
| `martagacha` | A4:522, DECK:557 | `мартагача` | |
| `boshqaruvchi` | A4:550 | `бошқарувчи` | `sh` + `q`→`қ` + `ch` в одном слове |
| `bog‘lovchi` | A4:545 | `боғловчи` | `g‘` + `ch` |

**Ложных срабатываний `ch` нет:** буква `c` вне диграфа встречается только в латинских
токенах (`CASE`, `Case`, `CAD`, `City`, `com`, `caseadvisory`, `catchment`, `Commercial`,
`Concept`, `Excel`, `finance`) - они и так в стоп-листе.

### 3.3 Диграф `ng` → `нг` и стык морфем `n`+`g`

**Ключевой вывод: `ng` в этом направлении безопасен.** Кириллическое `нг` - это две буквы,
`н` + `г`, поэтому диграфное и поморфемное чтение дают идентичный результат.
Тест всё равно нужен - но провалить его можно только неправильным порядком правил.

Слова, где `ng` - реальный стык морфем (основа на `-n` + суффикс на `g-`), а не диграф:

| Словоформа | Разбор | Где | Ожидаемая форма |
|---|---|---|---|
| `tasdiqlangan` | tasdiqlan + gan | A4:500, DECK:559 | `тасдиқланган` |
| `tasdiqlangandan` | tasdiqlan + gan + dan | A4:446, DECK:474 | `тасдиқлангандан` |
| `asoslangan` | asoslan + gan | A4:142, A4:325, A4:543, DECK:358 | `асосланган` |
| `kodlangan` | kodlan + gan | DECK:238 | `кодланган` |
| `bog‘langan` | bog‘lan + gan | A4:332 | `боғланган` |
| `Tanlangan` / `tanlangan` | tanlan + gan | A4:116, A4:421 | `Танланган` |
| `tashlang` | tashla + **ng** (повел. накл. мн. ч.) | A4:246 | `ташланг` |
| `tekshiring` | tekshir + ing | A4:246 | `текширинг` |
| `o‘chiring` | o‘chir + ing | A4:550 | `ўчиринг` |
| `o‘zgartirmang` | o‘zgartirma + ng | A4:332 | `ўзгартирманг` |
| `chiqmang` | chiqma + ng | DECK:81 | `чиқманг` |
| `bildirganingiz` | bildirgan + ingiz | A4:84 | `билдирганингиз` |

Слова, где `ng` - настоящий диграф внутри корня или суффикса `-ning`/`-ing`:

`so‘ng` (A4:446, A4:478, DECK:372, DECK:474) → `сўнг` ·
`eng` (A4:158, DECK:502) → `энг` ·
`ko‘ngilochar` (A4:142, A4:207, A4:401, DECK:244) → `кўнгилочар` ·
`Langar`/`langar` (A4:207, A4:409, DECK:65, DECK:244, DECK:600) → `Лангар` ·
`yangi` (A4:246) → `янги` ·
`konsalting`/`konsaltingi` (A4:31, A4:84, DECK:26, DECK:55) → `консалтинг`/`консалтинги` ·
`merchandayzing` (A4:218) → `мерчандайзинг` ·
`marketing` (A4:546, DECK:70) → `маркетинг` ·
генитив `-ning`: `bizning` (A4:158, A4:543), `mijozning` (A4:158), `loyihaning` (A4:329, DECK:362),
`Loyihaning` (A4:228, DECK:263), `qismining` (A4:142, A4:146, A4:423, DECK:31),
`majmuaning` (DECK:142), `majmuasining` (A4:82), `Buyurtmachining` (A4:573),
`mulkdorning` (A4:85), `ma‘lumotlarning` (A4:324, A4:391, DECK:357, DECK:418),
`Raqobatchilarning` (A4:186, DECK:219), `kitoblarning` (A4:553), `oldingisining` (A4:260, DECK:303),
`keyingisining` (A4:172, DECK:172), `kelishuvning` (DECK:133), `narxning` (DECK:452),
`shuning` (DECK:452), `uning` (DECK:133), `taklifning` (DECK:225), `mantig‘ining` (DECK:516),
`konsepsiyaning` (DECK:197), `hajmining` (DECK:166).

**Опаснейший случай - `ng‘`:**

| Словоформа | Где | Верно | Неверно, если `ng` матчится раньше `g‘` |
|---|---|---|---|
| `boshlang‘ich` | A4:391, A4:459, A4:552, DECK:418 | `бошланғич` | `бошланг‘ич` - остаётся висячий апостроф |
| `Boshlang‘ich` | A4:432, A4:459, DECK:573 | `Бошланғич` | `Бошланг‘ич` |

Правило: **`g‘` матчится раньше `ng`.** Это единственные два слова в корпусе с таким сочетанием,
и их обязательно надо в тесты.

### 3.4 `o‘` и `g‘` с типографским апострофом U+2018

В корпусе **107 словоформ** содержат U+2018. Из них 94 - это `o‘`/`g‘`, 13 - тутук белгиси (§3.8). Пересечения нет ни одного: ни в одном слове нет одновременно `o‘`/`g‘` и тутука.

Проверено побайтово: во всём тексте обоих файлов используется **только U+2018** (`‘`).
U+2019 (`’`), U+02BB (`ʻ`), U+02BC (`ʼ`), обратный апостроф (`` ` ``) - не найдены нигде.
ASCII-апостроф `'` найден только в атрибутах `data-label` DECK (§5, нарушение).

Опорные примеры:

| Словоформа | Где | Ожидаемая форма | Чем интересна |
|---|---|---|---|
| `bo‘lim` / `Bo‘lim` | `bo‘lim` A4:158, A4:172, DECK:171, DECK:172 · `Bo‘lim` DECK:200, DECK:228, DECK:257 | `бўлим` / `Бўлим` | базовый `o‘` + регистр |
| `bo‘yicha` | 25 вхождений: A4:68, A4:82, A4:190, A4:208, A4:239, A4:260, A4:277, A4:302, A4:329, A4:433, A4:495, A4:497, A4:561, DECK:209, DECK:220, DECK:246, DECK:310, DECK:335, DECK:362, DECK:366, DECK:435, DECK:522, DECK:541, DECK:542, DECK:574 | `бўйича` | самое частое `o‘`-слово |
| `O‘zbekiston` | A4:84, A4:122, A4:129, A4:591, DECK:55, DECK:113, DECK:120 | `Ўзбекистон` | **заглавная `O‘` → `Ў`** |
| `o‘z` | A4:260, A4:446, A4:544, A4:547, DECK:297, DECK:303, DECK:448 | `ўз` | слово из одной буквы + модификатора |
| `o‘n` | A4:547 | `ўн` | |
| `so‘ng` | A4:446, A4:478, DECK:372, DECK:474, DECK:522 | `сўнг` | `o‘` + `ng` |
| `to‘lov` / `To‘lov` | `to‘lov` A4:343, A4:432, A4:459, DECK:573, DECK:578, DECK:583 · `To‘lov` A4:428, DECK:567, DECK:569 | `тўлов` / `Тўлов` | |
| `ro‘yxat` / `ro‘yxati` | `ro‘yxat` DECK:427 · `ro‘yxati` A4:234, A4:528, DECK:275 | `рўйхат` / `рўйхати` | `o‘` + `y` + `x` |
| `qo‘shimcha` | A4:230, A4:324, A4:526, A4:550, DECK:357 | `қўшимча` | `q`→`қ`, `o‘`→`ў`, `sh`→`ш`, `ch`→`ч` в одном слове |
| `mo‘ljallari` | A4:567, DECK:441 | `мўлжаллари` | `j`→`ж` |
| `g‘oyadan` | DECK:55 | `ғоядан` | **`g‘` в начале слова** - единственный случай в корпусе |
| `bog‘liq` | A4:391, DECK:418 | `боғлиқ` | `g‘` + `q`→`қ` |
| `mantig‘i` / `mantig‘iga` / `mantig‘ining` | A4:211, A4:478, A4:493, DECK:247, DECK:516, DECK:539 | `мантиғи` / `мантиғига` / `мантиғининг` | |
| `Marg‘ilon` | A4:122, DECK:113 | `Марғилон` | **топоним с `g‘`**, при этом рядом в том же документе бренд `Margilon City Mall` пишется БЕЗ апострофа (A4:119, A4:121) |
| `yig‘imi` | A4:230, DECK:272 | `йиғими` | `yi` + `g‘` |
| `qog‘ozdagi` | DECK:55 | `қоғоздаги` | |
| `tasdig‘i` | A4:573 | `тасдиғи` | `g‘` в конце основы |
| `og‘zaki` | A4:217 | `оғзаки` | |
| `tug‘diradigan` | DECK:564 | `туғдирадиган` | |
| `bo‘g‘in` | A4:545 | `бўғин` | **`o‘` и `g‘` в одном коротком слове** |
| `to‘g‘ri` | DECK:452 | `тўғри` | **то же, обязательный тест** |
| `o‘zgartirmang` | A4:332 | `ўзгартирманг` | `o‘` + `ng` на конце |
| `qo‘riqlash` | A4:231, DECK:274 | `қўриқлаш` | три `қ`-подобных знака |

Полный список 107 словоформ с U+2018 (по алфавиту):

```
bog‘langan  bog‘liq  bog‘lovchi  Boshlang‘ich  boshlang‘ich  bo‘g‘in
bo‘ladigan  bo‘lganda  Bo‘lim  bo‘lim  bo‘limi  bo‘lishi
bo‘lmagan  bo‘lmasa  bo‘lsa  bo‘lsagina  bo‘yicha  g‘oyadan
iste‘molchi  ko‘chmas  ko‘ngilochar  ko‘p  ko‘ra  ko‘radi
ko‘rib  ko‘rsatamiz  ko‘rsatilgan  ko‘rsatilish  ko‘rsatkichlari  mantig‘i
mantig‘iga  mantig‘ining  Marg‘ilon  mas‘ul  ma‘lumotini  Ma‘lumotlar
ma‘lumotlar  ma‘lumotlarning  ma‘lumotni  mo‘ljallari  ob‘ekt  ob‘ektgacha
ob‘ektni  og‘zaki  o‘chiring  o‘lchamlari  o‘lchaymiz  o‘lchov
o‘n  o‘qib  o‘qiydigan  o‘rganish  o‘rni  o‘rnini
o‘rtacha  o‘stirish  o‘tamiz  o‘tish  o‘tkazamiz  o‘tkaziladi
o‘xshash  o‘z  o‘zagi  o‘zaro  O‘zbekiston  O‘zgarishlar
o‘zgarishlar  o‘zgarmas  o‘zgarsa  o‘zgartirmang  o‘zidan  o‘ziga
qat‘iylashtiriladi  qog‘ozdagi  qo‘riqlash  qo‘shiladi  qo‘shimcha  qo‘shishdan
qo‘yiladi  ro‘yxat  ro‘yxati  so‘ng  so‘zlari  tasdig‘i
ta‘minlaydi  ta‘sir  to‘g‘ri  to‘ldiriladi  to‘ldirilganligi  To‘liq
to‘liq  to‘liqligi  To‘lov  to‘lov  to‘lovlarni  to‘playmiz
To‘rt  to‘rt  tug‘diradigan  yig‘imi  Yo‘l  yo‘l
yo‘laklari  yo‘lga  yo‘li  Yo‘riqnoma  yo‘riqnomalarni
```

### 3.5 `ye` / `yo` / `yu` / `ya` в начале слова

| Словоформа | Где | Ожидаемая форма | Правило |
|---|---|---|---|
| `yer` | A4:141, A4:423, DECK:141, DECK:607 | `ер` | **`ye`-начальное → `е`, а не `йе`** (пример из самого ТЗ) |
| `yerda` | DECK:133, DECK:225, DECK:254 | `ерда` | |
| `yechimlari` | A4:36, A4:142, DECK:78, DECK:233 | `ечимлари` | |
| `Yetishmayotgan` | DECK:448 | `Етишмаётган` | `Ye`-начальное → `Е` **и** `yo` после гласной → `ё` в одном слове |
| `yakuniy` / `Yakuniy` | A4:85, A4:302, A4:325, A4:442, A4:446, A4:572, DECK:358, DECK:448 | `якуний` / `Якуний` | `ya` → `я` |
| `Yakka` | A4:544 | `Якка` | |
| `Yakun` | DECK:614 | `Якун` | |
| `yangi` | A4:246 | `янги` | `ya` + `ng` |
| `yaroqli` | A4:150, DECK:156 | `яроқли` | |
| `yarmi` | DECK:452 | `ярми` | |
| `yoki` | A4:329, A4:446, A4:518, A4:526, A4:544, DECK:362 | `ёки` | `yo` → `ё` |
| `yozma` | A4:391, A4:493, A4:528, A4:547, DECK:372, DECK:540 | `ёзма` | |
| `yoziladi` | A4:158 | `ёзилади` | |
| `yopiladi` | A4:391, A4:483, DECK:372, DECK:527 | `ёпилади` | |
| `yuk` | A4:209, DECK:243 | `юк` | `yu` → `ю` |
| `yuridik` / `Yuridik` | оба A4:543 | `юридик` / `Юридик` | |
| `yuritadigan` | A4:545 | `юритадиган` | |
| `yuborilgan` | A4:593 | `юборилган` | |
| `yuborishdan` | A4:550 | `юборишдан` | |
| `yuragi` | DECK:225 | `юраги` | |
| `yil` | A4:48, A4:108, A4:112, DECK:44 | `йил` | **`yi` - НЕ спецсочетание: `й`+`и`** |
| `yillik` | A4:228, A4:312, DECK:263, DECK:345 | `йиллик` | |
| `yillar` | A4:239 | `йиллар` | |
| `yiliga` | DECK:145 | `йилига` | |
| `yig‘imi` | A4:230, DECK:272 | `йиғими` | `yi` + `g‘` |

**Критический подслучай `yo‘` → `йў`, а НЕ `ё`:**

| Словоформа | Где | Верно | Неверно, если `yo` матчится раньше `o‘` |
|---|---|---|---|
| `yo‘l` / `Yo‘l` | A4:188, A4:488, A4:525, DECK:216, DECK:532 | `йўл` / `Йўл` | `ёъл` |
| `yo‘laklari` | A4:423, DECK:607 | `йўлаклари` | `ёълаклари` |
| `yo‘lga` | A4:526 | `йўлга` | |
| `yo‘li` | A4:547 | `йўли` | |
| `Yo‘riqnoma` | A4:158, A4:246, A4:332, A4:550 | `Йўриқнома` | |
| `yo‘riqnomalarni` | A4:550 | `йўриқномаларни` | |

Правило: **`o‘` матчится раньше `yo`.** Слово `yo‘q` из примера ТЗ в корпусе **не найдено**,
но семь его «родственников» выше дают ту же проверку.

### 3.6 `ye` / `yo` / `yu` / `ya` после гласной и после согласной

| Словоформа | Где | Ожидаемая форма | Позиция |
|---|---|---|---|
| `Osiyoda` | A4:84, DECK:55 | `Осиёда` | `yo` после `i` → `ё` |
| `ishlayotgan` | A4:569, DECK:55, DECK:443 | `ишлаётган` | `yo` после `a` → `ё` |
| `tayyorgarlik` | DECK:70 | `тайёргарлик` | **`yy`: первое `y`→`й`, второе `yo`→`ё`** |
| `tayyorlash` | A4:154, DECK:160 | `тайёрлаш` | то же |
| `tayyorlanadi` | A4:324, DECK:357 | `тайёрланади` | то же |
| `tayyormiz` | A4:85 | `тайёрмиз` | то же |
| `Buyurtmachi` | A4:39, A4:544, A4:545, A4:582, DECK:35 | `Буюртмачи` | `yu` после `u` → `ю`; ещё `buyurtmachi` A4:421 и `Buyurtmachining` A4:573 |
| `buyuruvchi` | A4:209, DECK:142, DECK:243 | `буюрувчи` | |
| `buyuruvchilar` | A4:142, A4:189, DECK:218 | `буюрувчилар` | |
| `byudjet` / `byudjeti` | `byudjet` A4:567, DECK:441 · `byudjeti` A4:297, DECK:330 | `бюджет` / `бюджети` | **`yu` после СОГЛАСНОЙ `b` → всё равно `ю`**; плюс `dj` → `дж` двумя буквами |
| `auditoriya` | A4:206, DECK:242 | `аудитория` | `ya` после `i` |
| `Demografiya` | A4:187, DECK:214 | `Демография` | |
| `energiya` | A4:231, DECK:274 | `энергия` | начальное `e`→`э` + `ya`→`я` |
| `geodeziya` | A4:557, DECK:431 | `геодезия` | |
| `galereya` | A4:207, DECK:244 | `галерея` | `e` после согласной + `ya` |
| `Kompaniya` / `kompaniyasi` | `Kompaniya` A4:40, A4:583, DECK:36 · `kompaniyasi` A4:84, DECK:55 | `Компания` / `компанияси` | |
| `moliyaviy` | A4:36, A4:154, A4:228, A4:329, DECK:60, DECK:78, DECK:160, DECK:192, DECK:257, DECK:263, DECK:362 | `молиявий` | `ya` в середине + `y` в конце → `й` |
| `tavsiya` / `TAVSIYA` | `tavsiya` A4:383, DECK:297, DECK:410, DECK:487 · `TAVSIYA` A4:265, DECK:308 | `тавсия` / `ТАВСИЯ` | **верхний регистр целиком** |
| `zinapoya` / `zinapoyalar` | A4:424, DECK:608 | `зинапоя` / `зинапоялар` | |
| `salohiyatiga` | A4:325, DECK:358 | `салоҳиятига` | `h`→`ҳ` + `ya` |
| `Hokimiyat` | A4:520, DECK:556 | `Ҳокимият` | |
| `majburiyatlar` | A4:569, DECK:443 | `мажбуриятлар` | |
| `versiya` | A4:518 | `версия` | |
| `g‘oyadan` | DECK:55 | `ғоядан` | `g‘` + `ya` после `o` |

**`ye` после гласной - не найдено.** **`ye` после согласной - не найдено.**
**`ya` после согласной - не найдено.** Единственная позиция `y`+гласная после согласной
в корпусе - `byudjet`/`byudjeti`.

### 3.7 `e` в начале слова против `e` после согласной

Начальное `e` → `э` (12 словоформ):

| Словоформа | Где | Ожидаемая форма |
|---|---|---|
| `Ekspert` | A4:277, DECK:310 | `Эксперт` |
| `ekspertizani` | A4:550 | `экспертизани` |
| `emas` | A4:158, DECK:297 | `эмас` |
| `eng` / `Eng` | A4:158, DECK:502, DECK:564 / DECK:133, DECK:452 | `энг` / `Энг` |
| `energiya` | A4:231, DECK:274 | `энергия` |
| `eskiz` | A4:210, DECK:245 | `эскиз` |
| `Eslatma` | DECK:447 | `Эслатма` |
| `esa` | DECK:297 | `эса` |
| `etish` | A4:547 | `этиш` |
| `etilgan` | DECK:427 | `этилган` |
| `etilmaguncha` | A4:572 | `этилмагунча` |
| `E` (в `E-versiya`) | A4:518 | `Э` (`Э-версия`) |

`e` после согласной → `е` (примеры):

| Словоформа | Где | Ожидаемая форма |
|---|---|---|
| `keladi` / `keladigan` | `keladi` DECK:452 · `keladigan` A4:544 | `келади` / `келадиган` |
| `kelishuv` / `Kelishuv` | `kelishuv` A4:68, A4:446, DECK:609 · `Kelishuv` A4:547 | `келишув` / `Келишув` |
| `necha` | A4:329, DECK:362 | `неча` |
| `bermaydi` | A4:543 | `бермайди` |
| `beradi` | A4:172, DECK:172 | `беради` |
| `tekshirish` | A4:493, DECK:539 | `текшириш` |
| `predmeti` / `predmetini` | `predmeti` A4:142 · `predmetini` DECK:23 | `предмети` / `предметини` |
| `rentabellik` | DECK:286 (`ichki rentabellik darajasi`) | `рентабеллик` |
| `merchandayzing` | A4:218 | `мерчандайзинг` |
| `model` / `modeli` | `model` A4:239, DECK:60, DECK:192, DECK:266, DECK:506 · `modeli` A4:232, A4:297, DECK:191, DECK:273, DECK:330 | `модел` / `модели` |
| `Demografiya` | A4:187, DECK:214 | `Демография` |
| `geodeziya` | A4:557, DECK:431 | `геодезия` |
| `Beshta` | A4:550 | `Бешта` |
| `Bekor` / `bekor` | оба A4:547 | `Бекор` / `бекор` |

`e` после гласной → `е` (не `э`):

| Словоформа | Где | Ожидаемая форма | Комментарий |
|---|---|---|---|
| `Orientir` / `orientir` | A4:272, A4:85 | `Ориентир` / `ориентир` | `e` после `i` |
| `galereya` | A4:207, DECK:244 | `галерея` | второе `e` после `r`, но перед `ya` |

`e` после тутук белгиси → `е`:

| Словоформа | Где | Ожидаемая форма |
|---|---|---|
| `ob‘ekt` | A4:158, A4:329, A4:569, DECK:362 | `объект` |
| `ob‘ektni` | A4:84 | `объектни` |
| `ob‘ektgacha` | DECK:55 | `объектгача` |
| `iste‘molchi` | A4:183, DECK:213 | `истеъмолчи` |

### 3.8 Тутук белгиси (апостроф) внутри слова

**13 словоформ.** Все они используют **U+2018**, хотя §7.2 ТЗ предписывает для тутук белгиси
знак `’` (U+2019). Это расхождение шаблонов с ТЗ - см. §5, пункт 1.

| Словоформа | Где | Ожидаемая форма | Комментарий |
|---|---|---|---|
| `ma‘lumotlar` | A4:459, A4:552, DECK:426 | `маълумотлар` | тутук после `a` |
| `Ma‘lumotlar` | A4:572, DECK:448, DECK:631 | `Маълумотлар` | |
| `ma‘lumotlarning` | A4:324, A4:391, DECK:357, DECK:418 | `маълумотларнинг` | тутук + `ng` |
| `ma‘lumotini` | A4:172, DECK:172 | `маълумотини` | |
| `ma‘lumotni` | DECK:448 | `маълумотни` | |
| `ob‘ekt` | A4:158, A4:329, A4:569, DECK:362 | `объект` | **тутук после `b` → `ъ` как разделительный** |
| `ob‘ektni` | A4:84 | `объектни` | |
| `ob‘ektgacha` | DECK:55 | `объектгача` | |
| `iste‘molchi` | A4:183, DECK:213 | `истеъмолчи` | тутук после `e` |
| `mas‘ul` | A4:500, A4:528, DECK:559 | `масъул` | тутук после `s` |
| `qat‘iylashtiriladi` | DECK:142, DECK:234 | `қатъийлаштирилади` | тутук после `t` + `sh` |
| `ta‘minlaydi` | A4:142 | `таъминлайди` | |
| `ta‘sir` | DECK:448 | `таъсир` | |

**Как отличать тутук от модификатора при одном и том же U+2018:**
в этом корпусе достаточно позиционного правила - U+2018 после `o` или `g` = модификатор
(`ў`/`ғ`), в любой другой позиции = тутук белгиси (`ъ`). Ни одно из 13 слов выше
не имеет `‘` после `o`/`g`, ни одно из 94 слов с `o‘`/`g‘` не имеет тутука после `o`/`g`.
Правило проверено на всём корпусе - конфликтов **не найдено**.

### 3.9 `ts` → `ц` и слова, где механическое правило даёт нестандартную кириллицу

`ts` встречается только в 4 словоформах, все - корректные:

| Словоформа | Где | Ожидаемая форма |
|---|---|---|
| `investitsiya` | A4:105, A4:312, A4:325, DECK:101, DECK:297, DECK:345, DECK:358 | `инвестиция` |
| `Investitsiya` | A4:154, A4:234, DECK:160, DECK:275 | `Инвестиция` |
| `navigatsiya` | A4:208, DECK:246 | `навигация` |
| `operatsion` | A4:84, DECK:282 | `операцион` |

**Ложных срабатываний `ts` нет:** ни одного слова, где `t` заканчивает морфему, а `s` начинает
следующую, в корпусе не найдено.

Зато есть обратная проблема - слова, где по-узбекски пишут `s`, а в кириллице традиционно `ц`.
Механическое правило даёт формально обратимый, но непривычный результат:

| Словоформа | Где | Механически (обратимо) | Традиционно (необратимо) |
|---|---|---|---|
| `konsepsiya` | A4:36, A4:82, A4:84, A4:204, DECK:78, DECK:113, DECK:127, DECK:142, DECK:228, DECK:234, DECK:452 | `консепсия` | `концепция` |
| `Konsepsiya` | A4:60, A4:201, A4:218, A4:478, DECK:59, DECK:183, DECK:206, DECK:233, DECK:502, DECK:516, DECK:522 | `Консепсия` | `Концепция` |
| `konsepsiyasi` | A4:142, DECK:31, DECK:120 | `консепсияси` | `концепцияси` |
| `Konsepsiyaning` | A4:181 | `Консепсиянинг` | `Концепциянинг` |
| `konsepsiyaning` | DECK:197 | `консепсиянинг` | `концепциянинг` |
| `Potensial` | A4:189, DECK:218 | `Потенсиал` | `Потенциал` |
| `tendensiyalari` | A4:183, DECK:213 | `тенденсиялари` | `тенденциялари` |
| `funksional` | A4:204, DECK:234 | `функсионал` | `функционал` |
| `funksiyali` | A4:36, A4:141, DECK:140 | `функсияли` | `функцияли` |

Требование §7.2 - `toLatn(toCyrl(x)) === x`. Словарь исключений (`konsepsiya`→`концепция`)
это требование **ломает**: `концепция` → `konsepsiya` не восстановится без второго словаря.
Решение нужно принять явно, см. §5 пункт 4.

### 3.10 Прочие места, которые обязаны попасть в тесты

| Словоформа | Где | Ожидаемая форма | Почему |
|---|---|---|---|
| `mehmonxona` | A4:527, DECK:559 | `меҳмонхона` | **`h`→`ҳ` и `x`→`х` в одном слове** - главный тест на различение |
| `Shermuhamedov` | A4:87, A4:577, DECK:640 | `Шермуҳамедов` | `Sh`→`Ш` + `h`→`ҳ` |
| `o‘xshash` | A4:544, DECK:81 | `ўхшаш` | `x`→`х` рядом с `sh`→`ш` |
| `sharh` | A4:183, DECK:213 | `шарҳ` | `h` в абсолютном конце слова |
| `muhr` | A4:579, A4:585 | `муҳр` | |
| `huquqini` | A4:546 | `ҳуқуқини` | `h`→`ҳ` + `q`→`қ` дважды |
| `qo‘riqlash` | A4:231, DECK:274 | `қўриқлаш` | |
| `TAVSIYA` | A4:265, DECK:308 | `ТАВСИЯ` | всё слово капсом |
| `AQSh` | A4:446, DECK:609 | `АҚШ` | диграф в конце капс-аббревиатуры |
| `MChJ` | A4:577 | `МЧЖ` | диграф в середине смешанного регистра |
| `hisob-kitob` и производные | A4:188, A4:267, A4:392, A4:421, A4:433, A4:446, A4:455, A4:478, A4:553, DECK:460, DECK:587, DECK:609 | `ҳисоб-китоб` | дефисные составные, 6 форм: `hisob-kitob`, `Hisob-kitob`, `hisob-kitobi`, `Hisob-kitoblar`, `hisob-kitoblarning` |
| `ketma-ket` | A4:172, DECK:166 | `кетма-кет` | |
| `turar-joy` / `Turar-joy` | A4:141, A4:397, A4:423, A4:424, DECK:141, DECK:591, DECK:607, DECK:608 | `турар-жой` / `Турар-жой` | `j`→`ж` |
| `narx-navo` | A4:332, DECK:452 | `нарх-наво` | |
| `kirish-chiqish` / `kirish-chiqishni` | DECK:215, A4:184 | `кириш-чиқиш` / `кириш-чиқишни` | диграф с обеих сторон дефиса |
| `Arxitektura-funksional` | A4:204, DECK:234 | `Архитектура-функсионал` | см. §3.9 |
| `texnik-iqtisodiy` | DECK:262 | `техник-иқтисодий` | |
| `sana-vaqt` | A4:528 | `сана-вақт` | |
| `SWOT-tahlil` | A4:190, DECK:220 | `SWOT-таҳлил` | **смешанный токен: латиница + дефис + узбекский** |
| `E-versiya` | A4:518 | `Э-версия` | смешанный токен: начальное `E`→`Э` |
| `tenant-mix` / `rent-roll` | A4:186, A4:232, DECK:65, DECK:184, DECK:219, DECK:225, DECK:273 | без изменений | целиком в стоп-листе |
| `F.I.Sh.` | A4:83, A4:583 | `Ф.И.Ш.` | точки внутри аббревиатуры |

---

## 4. Проверка глоссария §7.1 «Use this / Not this» (22 пары)

В таблице §7.1 ТЗ (строки 268-290 файла `CASE-OS-Offer-Builder-prompt.md`) - **22 пары**.
Прогнал каждую по обоим файлам, включая `data-speaker-notes` и `data-label`
(регистронезависимый поиск по корню, не по точной форме; в строках с двумя допустимыми
вариантами проверялись оба, всего 26 проверок).

**Итог: 1 нарушение из 22 пар.**

### 4.1 Найденные нарушения

**Нарушение 1 - единственное.**

- Пара глоссария: `chizmalar` (use this) / **`sxemalar`** (not this)
- Файл: `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/CASE Taklif Prezentatsiya.dc.html`
- **Строка 166**, атрибут `data-speaker-notes` слайда `05 Ish hajmi · umumiy`
- Найденная форма: **`sxemasi`** (та же основа `sxema`, что и запрещённое `sxemalar`)
- Точная цитата (дословно, целиком атрибут):

  > `Ish hajmining umumiy sxemasi. Uch bo‘lim ketma-ket, har biri keyingisining kirish ma‘lumotini beradi. Batafsil keyingi uch slaydda.`

- Контекст: это заметка докладчика, в видимый текст слайда она не попадает,
  но в PPTX-экспорт попадёт. При этом в **видимом** тексте обоих шаблонов везде используется
  правильное `chizma`/`chizmalar` (14 вхождений `chizma`, A4:364, A4:366, A4:368, A4:438, A4:511,
  A4:514, DECK:391, DECK:393, DECK:395, DECK:552, DECK:554, DECK:579 и др.;
  `chizmalar` - A4:287, DECK:320, DECK:452, DECK:502; `Chizmalarni` - A4:493, DECK:539).
- Предлагаемая правка: `Ish hajmining umumiy sxemasi.` → `Ish hajmining umumiy tuzilishi.`
  (или `…umumiy ko‘rinishi.`). Слово `chizmasi` тут по смыслу не подходит - речь о структуре,
  а не о чертеже, поэтому подстановка из глоссария «в лоб» даст бессмыслицу.

### 4.2 Остальные 21 пара - нарушений не найдено

| Use this | Not this | Запрещённая форма в шаблонах | Правильная форма в шаблонах |
|---|---|---|---|
| reja yechimlari, qavat rejalari | planirovka | не найдено | `reja yechimlari` A4:36, A4:142, DECK:78, DECK:233; `Qavat rejalari` A4:559, DECK:433 |
| avtoturargoh | parking | не найдено | `avtoturargoh` A4:209, A4:413, A4:417, DECK:243, DECK:603; `avtoturargohi` A4:141, A4:423, DECK:141, DECK:607; `Avtoturargoh` A4:413, DECK:603 |
| savdo galereyasi, savdo | riteyl | не найдено | `Savdo galereyasi` A4:405, DECK:597; `savdo` A4:142, A4:188, A4:409, DECK:216, DECK:600 |
| xizmat, xizmat yig‘imi | servis | не найдено | `xizmat yig‘imi` A4:230, DECK:272; `xizmat` - 16 вхождений |
| foydalanish (bosqichi, xarajati) | ekspluatatsiya | не найдено | `foydalanish bosqichidagi` A4:204, DECK:234; `foydalanish xarajati` DECK:142; `foydalanish` A4:231, A4:546, DECK:274 |
| tozalash | klining | не найдено | `tozalash` A4:231 |
| boshqaruv xarajatlari | administratsiya | не найдено | точной фразы `boshqaruv xarajatlari` тоже не найдено - пара в этом корпусе не задействована |
| qiyosiy tahlil | benchmarking | не найдено | `qiyosiy tahlil` не найдено - пара не задействована |
| risklar ro‘yxati | risklar reestri | не найдено | `risklar ro‘yxati` A4:234, DECK:275 |
| boshlang‘ich to‘lov | mobilizatsiya to‘lovi | не найдено | `Boshlang‘ich to‘lov` A4:432, DECK:573; `boshlang‘ich to‘lov` A4:459 |
| yakka hamkorlik | eksklyuzivlik | не найдено | `Yakka hamkorlik.` A4:544 |
| maslahat | konsultatsiya | не найдено | `maslahat` A4:497, A4:543, DECK:542; `maslahatlarini` A4:543; `maslahatchi` A4:546; `maslahatdan` A4:543 |
| o‘lchamlari | gabaritlari | не найдено | `qurilish o‘lchamlari` A4:423, DECK:607 |
| topografik o‘lchov (geodeziya) | s‘yomka | не найдено | `Topografik o‘lchov (geodeziya)` A4:557, DECK:431 |
| kirish zallari, qabul zonasi | vestibyul, konsyerj zonasi | не найдено | `kirish zallari` A4:424, DECK:608; `qabul zonasi` A4:424, DECK:608 |
| turar-joy zinapoya va liftlari | vertikal kommunikatsiyalar | не найдено | `turar-joy zinapoya va liftlari` A4:424; `Turar-joy zinapoya va liftlari` DECK:608 |
| tekshirish | validatsiya | не найдено | `tekshirish` A4:493, DECK:539 |
| xarajatlarni kamaytirish | optimallashtirish | не найдено | `Xarajatlarni kamaytirish tavsiyalari` A4:235, DECK:277 |
| bozordagi o‘rni | pozitsiyalanish | не найдено | `bozordagi o‘rni` A4:146, A4:190, DECK:152, DECK:220 |
| ochilishga tayyorgarlik | pre-opening | не найдено | `Ochilishga tayyorgarlik` DECK:70 |
| brend jalb qilish | brend sorsing | не найдено | `Ijara va brend jalb qilish` DECK:64 |
| chizmalar | sxemalar | **НАЙДЕНО, см. §4.1** | `chizmalar` A4:287, DECK:320, DECK:452, DECK:502 |

### 4.3 Пограничный случай (формально не нарушение)

- `A4:260`: `Commercial Concept - ishlanish chuqurligi bo‘yicha optimal variant.`
  Слово **`optimal`** - прилагательное. Глоссарий запрещает существительное
  `optimallashtirish` (вместо `xarajatlarni kamaytirish`), а не корень как таковой.
  Формы `optimallashtirish` / `optimizatsiya` в шаблонах **не найдены**.
  Тем не менее для линтера из §7.1 («Add a lint rule / review checklist item»)
  корень `optimal` даст ложное срабатывание - правило надо писать на форму
  `optimallash*` / `optimizats*`, а не на `optimal*`.

### 4.4 Интернациональные термины из §7.1, оставленные как есть - все на месте

`konsepsiya` (20 форм), `Format` (A4:206, DECK:60, DECK:184, DECK:242) и `formatini` (A4:146, DECK:152)
- строчного `format` в шаблонах нет,
`investitsiya` (12 форм), `moliyaviy TEA` (A4:36, A4:64, A4:225, DECK:190, DECK:254, DECK:257) -
отдельно `TEA` без `moliyaviy` ещё на DECK:59 и DECK:127,
`GLA` (6), `NOI` (3), `IRR` (5), `NPV` (5), `OpEx` (3), `rent-roll` (2),
`tenant-mix` (5), `merchandayzing` (A4:218) и `merchandise mix` (A4:297, A4:325, DECK:330, DECK:358),
`catchment` (2), `F&B` (5), `stilobat` - формы `stilobati` (A4:141, A4:423, DECK:141, DECK:607)
и `stilobatga` (A4:423, DECK:607).

`USP` - требование ТЗ «always glossed as "asosiy ustunlik (USP)" on first use» **выполнено**:
A4:206 `Format, asosiy ustunlik (USP) va maqsadli auditoriya`,
DECK:242 `Format, asosiy ustunlik (USP) va maqsadli auditoriya`. Других вхождений `USP` нет.

---

## 5. Проблемы, противоречия и подозрительные места

**1. Тутук белгиси набран не тем знаком, что требует §7.2.**
ТЗ: `the tutuq belgisi ’ → ъ` (U+2019). В шаблонах все 13 словоформ с тутуком используют
**U+2018** - тот же символ, что и модификатор в `o‘`/`g‘`.
Затронуто: `ma‘lumotlar` (A4:459, A4:552, A4:572, DECK:426, DECK:448, DECK:631),
`ma‘lumotlarning` (A4:324, A4:391, DECK:357, DECK:418), `ma‘lumotini` (A4:172, DECK:172),
`ma‘lumotni` (DECK:448), `ob‘ekt` (A4:158, A4:329, A4:569, DECK:362), `ob‘ektni` (A4:84),
`ob‘ektgacha` (DECK:55), `iste‘molchi` (A4:183, DECK:213), `mas‘ul` (A4:500, A4:528, DECK:559),
`qat‘iylashtiriladi` (DECK:142, DECK:234), `ta‘minlaydi` (A4:142), `ta‘sir` (DECK:448).
Решение нужно принять до написания транслитератора: либо (а) чинить шаблоны на U+2019
и требовать U+2019 в тестах, либо (б) принять U+2018 в обеих ролях и разрешать её позиционно
(после `o`/`g` - модификатор, иначе - тутук). Вариант (б) на этом корпусе работает без единого
конфликта (проверено, §3.8), но противоречит букве ТЗ.

**2. ASCII-апостроф `'` в атрибутах `data-label` презентации - прямое нарушение §7.2.**
§7.2: «Typographic apostrophes: always `o‘`/`g‘` (U+2018) in Latin output, never `'` or `` ` ``».
Найдено 5 значений:
- `DECK:197` - `data-label="06 Bo'lim A"` (должно быть `Bo‘lim A`)
- `DECK:225` - `data-label="07 Bo'lim B"`
- `DECK:254` - `data-label="08 Bo'lim C"`
- `DECK:421` - `data-label="11 Ma'lumotlar"` (должно быть `Ma‘lumotlar`)
- `DECK:564` - `data-label="14 To'lov tartibi"` (должно быть `To‘lov tartibi`)

При этом в `data-speaker-notes` тех же самых слайдов написано правильно:
DECK:197 `A bo‘limi.`, DECK:225 `B bo‘limi`, DECK:254 `C bo‘limi.`, DECK:421 `…ma‘lumotlar.`,
DECK:564 `To‘lov va hisob-kitob maydoni.` То есть один и тот же слайд содержит
и правильное, и неправильное написание. В A4-шаблоне таких мест **не найдено** -
там все 7 `data-screen-label` без апострофов вообще.

**3. Порядок правил, который обязан быть покрыт тестами (иначе ломается на реальных словах):**
- `g‘` раньше `ng` - иначе `boshlang‘ich` (A4:391, A4:459, A4:552, DECK:418) и
  `Boshlang‘ich` (A4:432, A4:459, DECK:573) дают `бошланг‘ич` с висячим апострофом;
- `o‘` раньше `yo` - иначе все 7 форм `yo‘l`/`Yo‘l`/`yo‘laklari`/`yo‘lga`/`yo‘li`/`Yo‘riqnoma`/
  `yo‘riqnomalarni` дают `ёъл` вместо `йўл`;
- `sh`/`ch` раньше одиночных `s`/`c`/`h` - минимальный тест `ishchi` (A4:500);
- `ts` раньше одиночных `t`/`s` - `investitsiya`, `navigatsiya`, `operatsion`;
- **`ng` - правило-пустышка** в направлении latn→cyrl: `нг` = `н`+`г`, поэтому диграфное
  и поморфемное чтение совпадают. Тест нужен, но провалить его можно только косвенно
  (через конфликт с `g‘`, см. выше).

**4. Обратимость против привычной орфографии - конфликт требований §7.2.**
Девять словоформ (`konsepsiya` и 4 её формы, `Potensial`, `tendensiyalari`, `funksional`,
`funksiyali`) по-кириллически традиционно пишутся через `ц`, но в латинице у них `s`, а не `ts`.
Механическое правило даёт `консепсия`/`потенсиал`/`функсионал` - некрасиво, но обратимо.
Словарь исключений даст красиво, но **сломает `toLatn(toCyrl(x)) === x`**, потому что
`концепция` → `kontseptsiya`, а не `konsepsiya`. Тем же затронуты `portfel` (A4:329, DECK:362)
и `model`/`modeli` (A4:232, A4:239, A4:297, DECK:60, DECK:191, DECK:192, DECK:266, DECK:273,
DECK:330, DECK:506) - мягкий знак `ь` в таблице §7.2 отсутствует вовсе.
Рекомендация: оставить механическое правило (обратимость важнее), а расхождения
вынести в отдельный список «допустимых нестандартных написаний» для ревью.

**5. Одна и та же сущность записана двумя способами в одном документе.**
- `Margilon City Mall` (A4:119, A4:121, DECK:110, DECK:112) - без апострофа, это бренд;
  строкой ниже `Marg‘ilon, O‘zbekiston` (A4:122, DECK:113) - с апострофом, это топоним.
- `Tashkent City Park` (A4:126, A4:128, DECK:117, DECK:119) - бренд;
  `Toshkent, O‘zbekiston` (A4:129, DECK:120) - топоним.
Транслитератор обязан НЕ трогать первые и обязан транслитерировать вторые
(`Марғилон`, `Тошкент`). Сегментация по «латинскому имени собственного» тут не работает -
нужен стоп-лист именно на строки-бренды целиком.

**6. Плейсхолдеров `{{...}}` в презентации нет вообще (0), а в A4 их 4 - и все в CSS.**
Правило «не транслитерировать содержимое `{{placeholders}}`» на этом корпусе
проверить нечем. Реальные «дырки под заполнение» сделаны узбекским текстом
(`«Loyiha nomi»`, `Kompaniya nomi`, `F.I.Sh.`, `kun oy yil`, `Lavozimi`,
`Shahar, mamlakat`, `shahar, tuman`), который транслитерировать НАДО.
Если раздел 7.2 предполагает property-тест на плейсхолдерах - тестовые данные придётся
придумывать, из шаблонов их не взять.

**7. Единицы с узбекским хвостом: `USD/oy` (A4:482, DECK:526) и `USD/soat` (A4:487, DECK:531).**
Стоп-лист «units (m²)» их не покрывает. `oy` и `soat` - обычные узбекские слова
(`ой`, `соат`), и они же встречаются в корпусе отдельно: `oy` - A4:48, A4:482, A4:483, A4:495,
DECK:44, DECK:526, DECK:527, DECK:540 (в т.ч. в плейсхолдере даты `kun oy yil`, A4:48, DECK:44);
`soat` - A4:487, A4:526, DECK:516, DECK:531; `soatgacha` - A4:525, DECK:559. Решить: `USD/oy` → `USD/ой` или `USD/oy`.
То же для `$80/soat` (A4:526, DECK:516).

**8. Аббревиатуры `TEA`, `TT`, `TIK`, `MChJ`, `AQSh` - узбекские, а не английские.**
Стоп-лист §7.2 перечисляет только латинские (CASE, Excel, DWG, PDF, NOI/IRR/NPV, F&B).
Эти пять - узбекские сокращения, их скорее надо транслитерировать (`ТЭА`, `ТТ`, `ТИК`,
`МЧЖ`, `АҚШ`), и на них ломается наивное правило «токен целиком в верхнем регистре = не трогать»
(`MChJ` и `AQSh` не в верхнем регистре целиком). Отдельно неясно `TEA`: буква `E` внутри
аббревиатуры - «начальная» (`Э`) или нет (`Е`)?

**9. Одиночные латинские буквы `A`, `B`, `C`, `D` работают в двух ролях сразу.**
`A`/`B`/`C` - индексы блоков (`Bo‘lim A`, A4:55, A4:177, DECK:175 …), `D` - индекс тарифа (A4:67);
и одновременно `B` - часть `F&B` (A4:142, A4:207, A4:401, DECK:244, DECK:594),
`D` - часть `3D` (A4:287, DECK:320), `A` - инициал в `Shermuhamedov A. A.` (A4:577).
Односимвольный стоп-лист по букве работать не будет; нужна привязка к контексту токена.

**10. `data-speaker-notes` - 15 непроверенных узбекских абзацев.**
Они не видны в вёрстке, поэтому легко выпадают из ревью - единственное нарушение
глоссария (§4.1) нашлось именно там. Из них же пришли 108 словоформ, которых нет
в видимом тексте (`kimmiz`, `zanjirini`, `o‘zagi`, `yuragi`, `pulga`, `Formulani`,
`tug‘diradigan`, `to‘g‘ri` и др.). Линтер §7.1 обязан их покрывать.

**11. Регистр диграфов.**
В корпусе есть все три варианта: строчный (`shahar`, `chizma`), титульный
(`Shahar` A4:44, `Chizmalarni` A4:493, `Bo‘lim` DECK:200) и полностью прописной
(`TAVSIYA` A4:265, DECK:308; `AQSh` A4:446, DECK:609 - тут `Sh` в титульном регистре
внутри капс-аббревиатуры; `MChJ` A4:577). Обратное преобразование `Ш` → `Sh` или `SH`
зависит от регистра соседей - правило надо задать явно, иначе `АҚШ` → `AQSH` ≠ `AQSh`
и property-тест падает.
