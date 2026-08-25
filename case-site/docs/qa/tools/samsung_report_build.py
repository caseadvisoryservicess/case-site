"""Сборка отчёта по Samsung BC в один HTML со встроенными картами.

Карты вшиваются как data URI: страница публикуется как артефакт, а он обязан быть
самодостаточным - внешние картинки в нём не загрузятся.
"""
import base64
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'samsung_report.html')


def img(name):
    with open(os.path.join(HERE, name), 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


HEAD = '''<title>Зона охвата Samsung BC</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{
  --paper:#FFFFFF; --panel:#F4F6F8; --panel-2:#E8ECF0;
  --ink:#14171B; --ink-2:#4A525B; --ink-3:#79828C;
  --rule:#D3D9DF; --rule-2:#B6BEC7;
  --accent:#9E0000; --accent-soft:#F7EAEA;
  --ok:#1B6B45; --ok-soft:#E3F0E9;
  --warn:#8A5300; --warn-soft:#F8EEDC;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#0F1215; --panel:#171B20; --panel-2:#1F252B;
  --ink:#E9ECEF; --ink-2:#A7B0B9; --ink-3:#78828C;
  --rule:#2A3138; --rule-2:#3B434C;
  --accent:#E86A6A; --accent-soft:#2A1A1C;
  --ok:#5FC391; --ok-soft:#142320;
  --warn:#DCA748; --warn-soft:#241D11;
}}
:root[data-theme="dark"]{
  --paper:#0F1215; --panel:#171B20; --panel-2:#1F252B;
  --ink:#E9ECEF; --ink-2:#A7B0B9; --ink-3:#78828C;
  --rule:#2A3138; --rule-2:#3B434C;
  --accent:#E86A6A; --accent-soft:#2A1A1C;
  --ok:#5FC391; --ok-soft:#142320;
  --warn:#DCA748; --warn-soft:#241D11;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:"Source Serif 4",Georgia,serif;font-size:17px;line-height:1.62;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:52px 28px 100px}
.col{max-width:700px}
code,.mono,.num{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace}
code{overflow-wrap:anywhere;font-size:.88em;background:var(--panel);border-radius:3px;padding:1px 5px}

header{border-bottom:2px solid var(--ink);padding-bottom:26px;margin-bottom:40px}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.17em;
  text-transform:uppercase;color:var(--accent);margin:0 0 14px;font-weight:500}
h1{font-family:Montserrat,sans-serif;font-weight:800;font-size:clamp(30px,4.6vw,46px);
  line-height:1.05;letter-spacing:-.022em;margin:0 0 16px;text-wrap:balance}
.lede{font-size:19px;color:var(--ink-2);margin:0;max-width:64ch}

h2{font-family:Montserrat,sans-serif;font-weight:800;font-size:25px;letter-spacing:-.017em;
  margin:0 0 10px;text-wrap:balance}
h3{font-family:Montserrat,sans-serif;font-weight:600;font-size:16px;margin:30px 0 8px;
  letter-spacing:-.005em}
.sec{margin:60px 0 0;padding-top:26px;border-top:1px solid var(--rule)}
.sec-lede{color:var(--ink-2);margin:0 0 24px;max-width:64ch}
p{margin:0 0 16px;max-width:64ch}
p strong{font-weight:600}
ul{margin:0 0 16px;padding-left:22px;max-width:64ch}
li{margin-bottom:9px}

/* показатели */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:1px;
  background:var(--rule);border:1px solid var(--rule);margin:0 0 26px}
.stat{background:var(--paper);padding:16px 18px}
.stat .k{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.09em;
  text-transform:uppercase;color:var(--ink-3);margin:0 0 7px}
.stat .v{font-family:Montserrat,sans-serif;font-weight:800;font-size:29px;line-height:1;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.stat .s{font-size:13px;color:var(--ink-2);margin-top:6px;line-height:1.35;
  font-family:"IBM Plex Mono",monospace}
.stat.hi .v{color:var(--accent)}

/* решение */
.verdict{border:1px solid var(--rule);border-left:3px solid var(--accent);
  background:var(--panel);padding:24px 26px;margin:0 0 28px}
.verdict h3{margin:0 0 10px;font-size:17px;font-weight:800;color:var(--accent)}
.verdict p:last-child{margin-bottom:0}

.note{border-left:3px solid var(--warn);background:var(--warn-soft);padding:18px 22px;margin:0 0 24px}
.note h3{margin:0 0 8px;font-size:14px;color:var(--warn);font-weight:800}
.note p{margin:0 0 10px;font-size:15.5px;color:var(--ink-2)}
.note p:last-child{margin-bottom:0}

/* таблицы */
.tw{overflow-x:auto;margin:0 0 22px;border:1px solid var(--rule)}
table{border-collapse:collapse;width:100%;min-width:520px;
  font-family:"IBM Plex Mono",monospace;font-size:13.5px}
th{text-align:left;padding:11px 15px;background:var(--panel-2);font-size:10px;
  letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);font-weight:500;
  border-bottom:1px solid var(--rule);white-space:nowrap}
td{padding:11px 15px;border-bottom:1px solid var(--rule);color:var(--ink-2);vertical-align:top;
  font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
td:first-child{color:var(--ink);font-weight:500}
td.n{text-align:right}
tr.tot td{background:var(--panel);font-weight:600;color:var(--ink)}

/* карты */
figure{margin:0 0 12px}
figure img{width:100%;height:auto;display:block;border:1px solid var(--rule);background:#fff}
figcaption{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink-3);
  margin-top:10px;line-height:1.5;max-width:88ch}
figcaption b{color:var(--ink-2);font-weight:500}

.pill{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:11px;
  padding:3px 9px;border-radius:3px;letter-spacing:.03em}
.pill.ok{background:var(--ok-soft);color:var(--ok)}
.pill.no{background:var(--warn-soft);color:var(--warn)}

footer{margin-top:64px;padding-top:22px;border-top:1px solid var(--rule);
  font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--ink-3);line-height:1.6}
@media (max-width:700px){.wrap{padding:34px 18px 72px}body{font-size:16px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
'''


def build():
    m1, m2, m3 = img('samsung_catchment_map.png'), img('samsung_demand_map.png'), img('samsung_supply_map.png')
    body = f'''<div class="wrap">

<header>
  <p class="eyebrow">CASE Real Estate Advisory · Ташкент</p>
  <h1>Зона охвата Samsung BC</h1>
  <p class="lede">Что показывать клиенту - круги или время в пути, сколько вокруг офисного предложения и почему население в этот отчёт не попало.</p>
</header>

<div class="col">
<h2>Короткий ответ на вопрос «что лучше»</h2>
<div class="verdict">
  <h3>Время в пути. Но не для того, о чём обычно спрашивают</h3>
  <p>Круг на карте выглядит научно и не значит ничего: он игнорирует канал Бозсу, железную дорогу и то, что до части «ближних» кварталов ехать вокруг. Время в пути клиент понимает без объяснений, потому что сам так и думает: «двадцать минут от дома».</p>
  <p><strong>Но для бизнес-центра ни то, ни другое не измеряет спрос.</strong> Офис снимает компания, а не сосед. Жители в радиусе километра - это не покупатели, это в лучшем случае будущие сотрудники и очередь в кофейню на первом этаже.</p>
</div>

<p>Поэтому два круга и одна изохрона отвечают на три разных вопроса, и смешивать их в одну цифру нельзя:</p>

<div class="tw"><table>
<thead><tr><th>Что показываем</th><th>На какой вопрос отвечает</th><th>Для Samsung BC</th></tr></thead>
<tbody>
<tr><td>Пешие 500 м</td><td>Комфорт рабочего дня: обед, банк, аптека</td><td>годится, считается по точкам обслуживания</td></tr>
<tr><td>15-30 мин на авто</td><td>Откуда приедут сотрудники арендатора</td><td>правильная рамка, но нужен маршрутный движок</td></tr>
<tr><td>Радиус 1-3 км</td><td>Конкурентное окружение: чьи офисы рядом</td><td>посчитано, см. ниже</td></tr>
</tbody></table></div>

<p>Практический вывод для презентации: <strong>покажите пешие 500 метров и 20 минут на авто</strong>, а конкурентов - радиусами. Три слайда вместо одного, зато ни одного числа, которое нельзя защитить на вопросе «а почему именно так».</p>

<div class="note">
  <h3>Настоящие изохроны в этом отчёте не построены</h3>
  <p>Для них нужен маршрутный движок и дорожная сеть с ограничениями скорости. В CASE OS дорожной сети нет (массив <code>ROADS</code> пуст), внешние маршрутные сервисы из рабочей среды недоступны. Рисовать «15 минут» окружностью радиусом скорость на время - это тот же круг, только с обманчивой подписью, поэтому здесь показаны честные радиусы.</p>
  <p>Чтобы получить настоящие: подключить OSRM или Valhalla на данных OpenStreetMap. Работа на день, считается потом бесплатно и для любого проекта.</p>
</div>
</div>

<div class="sec">
<h2>Что вокруг площадки</h2>
<p class="sec-lede">Точка проекта: <span class="mono">41.348743, 69.288219</span>, Юнусабадский район. Взята из гео-студии CASE OS, где её внёс и проверил владелец.</p>

<div class="stats">
  <div class="stat hi"><p class="k">БЦ в 1 км</p><div class="v">0</div><div class="s">ближайший 1,46 км</div></div>
  <div class="stat"><p class="k">БЦ в 2 км</p><div class="v">9</div><div class="s">все в Юнусабаде</div></div>
  <div class="stat"><p class="k">БЦ в 3 км</p><div class="v">23</div><div class="s">из 148 по городу</div></div>
  <div class="stat"><p class="k">До ядра рынка</p><div class="v">4,9</div><div class="s">км до центра масс БЦ</div></div>
  <div class="stat"><p class="k">Ставка района</p><div class="v">14</div><div class="s">$/м², медиана двух площадок</div></div>
</div>

<div class="col">
<p>Самое важное здесь - первый столбец. <strong>В радиусе километра от площадки нет ни одного действующего бизнес-центра.</strong> Ближайший, IBC, стоит в 1,46 км. Это читается двояко, и оба чтения надо проговорить клиенту: свободная ниша либо место, которое рынок пока обошёл стороной.</p>
<p>Второе чтение подкрепляется географией. Центр масс всех 148 бизнес-центров города лежит в <span class="mono">41,3056, 69,2766</span>, это Яккасарай и Мирабад. <strong>Samsung BC находится в 4,9 км от него.</strong> В трёх километрах от ядра рынка стоят 73 БЦ, вокруг Samsung - 23.</p>
</div>

<figure>
  <img src="{m1}" alt="Карта зоны охвата Samsung BC с радиусами 500 метров, 1, 2 и 3 километра">
  <figcaption><b>Карта 1.</b> Радиусы вокруг площадки. Тёмные точки - действующие БЦ в пределах 3 км, светлые - дальше. Видно, что всё предложение лежит к югу: Samsung BC стоит на северной кромке рынка, а не внутри него.</figcaption>
</figure>

<div class="col">
<div class="tw"><table>
<thead><tr><th>Радиус</th><th class="n">Площадь, км²</th><th class="n">Действующих БЦ</th><th class="n">В кольце</th></tr></thead>
<tbody>
<tr><td>500 м</td><td class="n">0,79</td><td class="n">0</td><td class="n">0</td></tr>
<tr><td>1 км</td><td class="n">3,14</td><td class="n">0</td><td class="n">0</td></tr>
<tr><td>2 км</td><td class="n">12,57</td><td class="n">9</td><td class="n">9</td></tr>
<tr><td>3 км</td><td class="n">28,27</td><td class="n">23</td><td class="n">14</td></tr>
<tr class="tot"><td>5 км</td><td class="n">78,54</td><td class="n">59</td><td class="n">36</td></tr>
</tbody></table></div>
</div>
</div>

<div class="sec">
<h2>Сколько людей живёт в зоне охвата</h2>
<p class="sec-lede">Ответа в этом отчёте нет, и это осознанное решение, а не пропуск.</p>

<div class="col">
<p>В CASE OS есть ровно один источник населения - сетка <code>pop</code> из <code>bundle_tashkent_realdata.json</code>, 6 865 ячеек по километру. Я посчитал по ней охват, получил <span class="mono">1 541</span> человека в 500 метрах и <span class="mono">53 711</span> в трёх километрах, а затем проверил сетку четырьмя способами. Она не прошла ни одну проверку.</p>

<div class="tw"><table>
<thead><tr><th>Проверка</th><th>Что должно быть</th><th>Что в данных</th></tr></thead>
<tbody>
<tr><td>Центр масс населения</td><td>около центра города</td><td>на <b>8,6 км южнее</b></td></tr>
<tr><td>Плотность Чиланзара</td><td>один из самых плотных районов</td><td>1 663 чел./км², в 11 раз ниже Янгихаёта</td></tr>
<tr><td>Верхние ячейки</td><td>разные значения</td><td>десять подряд по ~40 670</td></tr>
<tr><td>Сумма в границах города</td><td>около 3,0 млн</td><td>2,35 млн</td></tr>
</tbody></table></div>

<p>Перевёрнутая плотность и десять одинаковых максимумов - это не погрешность, а признак испорченного или неверно привязанного слоя. Сама система, к её чести, это уже помечает: в <code>population_grid.csv</code> у каждой строки стоит <span class="mono">«Методологический слой; проверить источник/единицу измерения»</span>, а в сводке <code>manual_verified: 0</code>.</p>

<div class="note">
  <h3>Почему я не показал числа с оговоркой</h3>
  <p>Цифра в презентации живёт своей жизнью. Через неделю «1 541 человек в 500 метрах» окажется в финмодели, ещё через месяц - в письме инвестору, и оговорка по дороге потеряется. Слой смещён на 8,6 км: это не «примерно», это про другое место.</p>
  <p>Второй источник в системе - 545 махаллей с полями <code>population</code> и <code>households</code>. Заполнено ноль. В самих данных стоит записка: «Добавить население, домохозяйства и GeoJSON границы при получении».</p>
</div>

<h3>Что нужно, чтобы ответ появился</h3>
<ul>
<li><strong>Население по махаллям</strong> от Госкомстата или хокимията. Это 545 записей, каркас под них в системе уже есть, нужны сами числа и границы полигонов. После этого охват считается за минуту и по любому проекту.</li>
<li><strong>Либо проверенный растр</strong>: WorldPop или GHSL, привязка проверяется по контрольным точкам до загрузки.</li>
<li>До этого в презентации по населению - прочерк и строка «источник согласовывается». Это выглядит профессиональнее, чем число, которое клиент проверит и не сойдётся.</li>
</ul>
</div>

<div class="sec">
<h2>Спрос: где на офис действительно платят</h2>
<p class="sec-lede">Раз населением спрос не измерить, измеряем тем, что арендатор реально заплатил.</p>
<div class="col">
<p>Ставка - прямое свидетельство спроса: это цена, на которую кто-то согласился. Данные собраны в июле 2026 с OLX и uybor (медианы по девяти районам) и с soffice.uz, управляющей компании 18 бизнес-центров, откуда взяты ставки собственника по конкретным зданиям.</p>
</div>

<figure>
  <img src="{m2}" alt="Карта медианных ставок аренды офисов по районам Ташкента">
  <figcaption><b>Карта 2.</b> Заливка - медианная ставка по району. Кружки - здания с известной ставкой, размер по её величине; подписаны пять самых дорогих. Верх рынка держат Summit, Trilliant, Nest one, Bomi и Forum, все в ядре города, ни одного в Юнусабаде.</figcaption>
</figure>

<div class="col">
<div class="tw"><table>
<thead><tr><th>Район</th><th class="n">OLX</th><th class="n">uybor</th><th class="n">Медиана</th></tr></thead>
<tbody>
<tr><td>Шайхантахур</td><td class="n">26,9</td><td class="n">17,9</td><td class="n">22,4</td></tr>
<tr><td>Мирабад</td><td class="n">22,0</td><td class="n">16,7</td><td class="n">19,4</td></tr>
<tr><td>Яшнабад</td><td class="n">20,0</td><td class="n">-</td><td class="n">20,0</td></tr>
<tr><td>Яккасарай</td><td class="n">20,3</td><td class="n">16,2</td><td class="n">18,3</td></tr>
<tr><td>Чиланзар</td><td class="n">16,7</td><td class="n">16,1</td><td class="n">16,4</td></tr>
<tr class="tot"><td>Юнусабад</td><td class="n">15,8</td><td class="n">13,1</td><td class="n">14,5</td></tr>
<tr><td>Мирзо-Улугбек</td><td class="n">-</td><td class="n">10,8</td><td class="n">10,8</td></tr>
</tbody></table></div>
<p>Юнусабад - средняя часть рынка: <span class="mono">14,5 $/м²</span> против <span class="mono">22,4</span> у Шайхантахура. При этом ориентиры по классам гораздо выше: <span class="mono">A+</span> в среднем <span class="mono">40,7 $</span>, <span class="mono">A</span> - <span class="mono">31,1 $</span>. Разрыв между районной медианой и классом означает, что <strong>ставка Samsung BC будет определяться классом здания, а не адресом</strong>. Это в пользу проекта: район не приговор, но и премию за адрес закладывать нельзя.</p>
<p>Одна цифра, которую нельзя пропустить при планировании: вакансия в классе A по открытым обзорам 2025 года составляет <span class="mono">23,3 %</span>. Почти четверть качественных площадей в городе стоит пустой.</p>
</div>
</div>

<div class="sec">
<h2>Предложение: где стоят бизнес-центры</h2>
<p class="sec-lede">148 действующих объектов из 2ГИС с координатами.</p>

<figure>
  <img src="{m3}" alt="Тепловая карта концентрации бизнес-центров Ташкента">
  <figcaption><b>Карта 3.</b> Плотность бизнес-центров, ядро сглаживания 1,2 км. Деловое ядро города компактное и лежит на стыке Яккасарая, Мирабада и Шайхантахура. Samsung BC отмечен звездой на северной периферии этого ядра.</figcaption>
</figure>

<div class="col">
<div class="tw"><table>
<thead><tr><th>Район</th><th class="n">БЦ</th><th>Район</th><th class="n">БЦ</th></tr></thead>
<tbody>
<tr><td>Мирабад</td><td class="n">30</td><td>Яшнабад</td><td class="n">17</td></tr>
<tr><td>Мирзо-Улугбек</td><td class="n">26</td><td>Чиланзар</td><td class="n">12</td></tr>
<tr><td>Яккасарай</td><td class="n">26</td><td>Шайхантахур</td><td class="n">9</td></tr>
<tr class="tot"><td>Юнусабад</td><td class="n">21</td><td>прочие</td><td class="n">7</td></tr>
</tbody></table></div>
<p>Юнусабад с 21 объектом - четвёртый район по числу БЦ, то есть офисы здесь есть и арендуются. Но карта 3 показывает, что они рассыпаны, а не собраны в кластер: тепловое пятно Юнусабада бледное и вытянутое вдоль магистралей, тогда как у Яккасарая и Мирабада - плотное ядро.</p>
</div>
</div>

<div class="sec">
<h2>Что из этого следует для проекта</h2>
<div class="col">
<p><strong>Место не в рынке, а рядом с рынком.</strong> Ноль конкурентов в километре и 4,9 км до ядра - две стороны одного факта. Это не приговор, но позиционировать проект как «в деловом центре» нельзя: клиент проверит по карте.</p>
<p><strong>Ставку определит класс, а не район.</strong> Медиана Юнусабада 14,5 $, но здания класса A в городе идут по 31 $. Разрыв в два раза - это и есть цена качества здания. Соответственно, экономика проекта держится на том, попадёт ли он в класс A, а не на локации.</p>
<p><strong>Вакансия 23,3 % в классе A - главный риск.</strong> Выходить с ещё одним объектом класса A в город, где четверть таких площадей пустует, можно только с якорным арендатором на входе. Это стоит проверить до финмодели, а не после.</p>
<p><strong>Чего в этом анализе не хватает и что закроет пробел:</strong> население по махаллям (для оценки кадрового бассейна), маршрутный движок (для честных изохрон) и данные по вакансии и поглощению по конкретным зданиям, а не по рынку в среднем.</p>
</div>
</div>

<footer>
Источники. Точка проекта: CASE OS, гео-студия, запись владельца со статусом Reviewed.
Бизнес-центры: 2ГИС, 148 объектов с координатами. Ставки: OLX.uz и uybor.uz, 07.2026,
медианы по району; поимённые ставки - soffice.uz, управляющая компания 18 БЦ.
Ориентиры по классам и вакансии: открытые рыночные обзоры, 2025. Границы районов:
Toshkent shahar chegarasi, 2024. Расчёты: <code>docs/qa/tools/samsung_catchment.py</code>
и <code>samsung_maps.py</code> в репозитории CASE OS, обе карты и все числа воспроизводятся
запуском этих файлов.
</footer>

</div>'''
    open(OUT, 'w', encoding='utf-8').write(HEAD + body)
    print('готово:', OUT, f'{os.path.getsize(OUT)/1048576:.1f} МБ')


if __name__ == '__main__':
    build()
