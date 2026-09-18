# CASE Geo - старт в Claude Code

Положите этот файл в рабочую папку, откройте её в терминале, запустите `claude`
и скажите: **«прочитай CLAUDE_CODE_START.md и выполни раздел ЗАДАЧА»**.

---

## КОНТЕКСТ (результат разбора open.ngis.uz)

Backend геопортала - ArcGIS Server 12 REST: `https://db.ngis.uz/db/rest/services`
Доступ анонимный, без токена. 27 сервисов, 26 с правами `Map,Query,Data`.

**Ключевые факты:**

1. У сервиса махаллей `UZKAD/MAHALLA_UZKAD_DB16/MapServer` стоит `capabilities: "Map"` -
   запросы закрыты. У сервиса-близнеца **`FeatureServer` того же слоя доступ полный**.
   Это единственный слой, который читается через FeatureServer. 4 672 махалли, все 14 регионов.

2. Три системы кодов: кадастровый префикс (`10`, `10:01`), SOATO (`1726`, `1726269`), UUID.
   Связь участок → махалля идёт ТОЛЬКО через `mahalla_code` (UUID).
   Кадастровый номер махалли = SOATO района + 3 цифры (`1712216006`).
   Кадастровый номер участка - другой формат (`10:08:42:03:02:0197`).

3. **Join по названиям районов делать нельзя** - в двух слоях 25 расхождений из 206
   (`shahar`/`shahri`, `Marxamat`/`Marhamat`). Только через `district_crosswalk.csv`.
   В SOATO пятый знак: `2` = туман, `4` = шахар. Без учёта типа одноимённые
   район и город схлопываются (`Buxoro tumani` ≠ `Buxoro shahri`).

4. Лимит сервера - 2000 записей на запрос, нужна пагинация через `resultOffset`.

5. Геометрия тяжёлая. Замер на слое махаллей:
   без генерализации 98 МБ | `maxAllowableOffset=0.0001` 7,9 МБ | `0.0002` 6,1 МБ | `0.0005` 3,3 МБ.
   Для веб-карты брать `0.0002`, для расчёта площадей - полную точность.

6. Известные дефекты данных: 229 011 нежилых участков (22%) без классификатора земель;
   SOATO `1712408` дублируется двумя написаниями «Zarafshon» / «Zarafshon shahri»;
   слой махаллей покрывает 4 672 из ~9-10 тыс. фактических МФЙ.

**Объёмы:** NOTURAR (нежилые) 1 037 235, из них Ташкент 90 113 · TURAR 1 891 147 ·
AGR 1 336 639 · KONTUR 1 170 399 · YER_TURI 1 052 719 · AVTOYUL 53 669 · MKD_FLOORS 28 998 ·
WATER 25 038 · DZY 11 855 · GENPLAN 7 569 · MKD_BUILD 3 046 · NALOG_ZONE 18 · TUMAN 206 · REGION 14

---

## ЗАДАЧА

1. Сохрани скрипт из раздела «СКРИПТ» ниже в `ngis_etl.py`.
2. `pip install requests` (для PostGIS также `geopandas sqlalchemy psycopg2-binary`).
3. Проверь связь: `python3 ngis_etl.py --list` - должны прийти живые счётчики.
4. Выкачай базовый набор:

```bash
python3 ngis_etl.py --layer REGION  --out region.geojson
python3 ngis_etl.py --layer TUMAN   --out tuman.geojson
python3 ngis_etl.py --layer MAHALLA --simplify 0.0002 --out mahalla_web.geojson
python3 ngis_etl.py --layer MAHALLA --no-geometry --out mahalla.csv
python3 ngis_etl.py --layer NALOG_ZONE --out nalog_zone.geojson
python3 ngis_etl.py --layer GENPLAN --out genplan.geojson
python3 ngis_etl.py --layer NOTURAR --where "soato_region='1726'" --out tashkent_comm.geojson
```

5. Проверь контрольные суммы: махаллей 4 672, районов 206, регионов 14, зон генплана 7 569.
6. Доложи, что выгрузилось и где расхождения.

Полезные фильтры: `soato_region='1726'` Ташкент · `soato_district='1726269'` Мирзо Улугбек ·
`land_fund_category='006003'` промышленность/транспорт/связь · `land_fund_type='006003001005'` зоны предпринимательства.

---

## СКРИПТ

```python
#!/usr/bin/env python3
"""
CASE Geo - ETL for the Uzbekistan National Geoinformation System (open.ngis.uz)
Backend: ArcGIS Server 12 REST at https://db.ngis.uz/db/rest/services  (anonymous, no token)

Pulls any catalogued layer to GeoJSON / CSV / PostGIS, republic-wide.

  python3 ngis_etl.py --list
  python3 ngis_etl.py --layer MAHALLA --out mahalla.geojson
  python3 ngis_etl.py --layer NOTURAR --where "soato_region='1726'" --out tashkent_comm.geojson
  python3 ngis_etl.py --layer MAHALLA --no-geometry --out mahalla.csv
  python3 ngis_etl.py --layer GENPLAN --postgis "postgresql://user:pw@host/db"
  python3 ngis_etl.py --layer MAHALLA --simplify 0.0002 --out mahalla_web.geojson   # 98MB -> ~6MB

Requires: requests  (optional: geopandas+sqlalchemy for --postgis)
"""
import argparse, csv, json, sys, time
import requests

BASE = "https://db.ngis.uz/db/rest/services"

# name -> (service path, layer id, server type)
# NOTE: MAHALLA's MapServer is capabilities="Map" (query blocked). Its FeatureServer
# sibling is fully queryable - that is why it is the only entry using FeatureServer.
LAYERS = {
    # --- administrative / reference ---
    "MAHALLA":    ("UZKAD/MAHALLA_UZKAD_DB16",            0, "FeatureServer"),  # 4,672 mahalla polygons, all 14 regions
    "TUMAN":      ("Hosted/tuman_border_map",             2, "MapServer"),      # 206 districts, kadastr prefix
    "REGION":     ("Hosted/cadastral_regions_map",        0, "MapServer"),      # 14 regions, kadastr prefix
    # --- parcels (spatial_unit_type_land; identical 27-field schema) ---
    "NOTURAR":    ("UZKAD/NOTURAR_UZKAD_DB16",            0, "MapServer"),      # 1,037,235 non-residential  <-- CRE core
    "TURAR":      ("UZKAD/TURAR_UZKAD_DB16",              0, "MapServer"),      # 1,891,147 residential
    "AGR":        ("UZKAD/AGR_ONLY_UZKAD_DB16",           0, "MapServer"),      # 1,336,639 agricultural
    "DZY":        ("UZKAD/DZY_UZKAD_DB16",                0, "MapServer"),      #    11,855 state reserve land
    "FOREST":     ("UZKAD/FOREST_UZKAD_DB16",             0, "MapServer"),      #     3,062 forest fund
    "WATER":      ("UZKAD/WATER_UZKAD_DB16",              0, "MapServer"),      #    25,038 water fund
    "AVTOYUL":    ("UZKAD/AVTOYUL_UZKAD_DB16",            0, "MapServer"),      #    53,669 roads
    "MUHOFAZA":   ("UZKAD/MUHOFAZA_UZKAD_DB16",           0, "MapServer"),      #        69 protected areas
    # --- cadastre contours ---
    "KONTUR":     ("Hosted/KONTUR_QAYDNOMA_MAP",          0, "MapServer"),      # 1,170,399 contour register (53 fields)
    "YER_TURI":   ("Hosted/Yer_turi_konturi_bilan_map",   0, "MapServer"),      # 1,052,719 land-type contours
    "TUTASH":     ("Hosted/TUTASH_YERLAR_MAP",            0, "MapServer"),      #    10,765 adjacent lands
    "DKYAT":      ("Hosted/DKYAT_2023_MAP",               0, "MapServer"),
    # --- Tashkent city planning (city-limited by nature) ---
    "GENPLAN":    ("Hosted/TOSHKENT_GENPLAN_3857_MAP",    2, "MapServer"),      # 7,569 genplan zones: funksiya, qavatlilik, seismic
    "NALOG_ZONE": ("Hosted/TOSHKENT_NALOG_ZONE_MAP",      0, "MapServer"),      #    18 land-tax zones ez_tashkent_1..5
    # --- building stock (MKD = multi-apartment) ---
    "MKD_BUILD":  ("mkd_buildings",                       2, "MapServer"),      #  3,046 buildings (47 fields)
    "MKD_FLOORS": ("mkd_floors",                          0, "MapServer"),      # 28,998 floors
    "MKD_BLOCKS": ("mkd_building_blocks",                 0, "MapServer"),      #  6,604 blocks
    "MKD_PROJ":   ("mkd_projects",                        4, "MapServer"),      #  1,393 projects
    "CAD_PASSP":  ("cadastrehomemkd",                     0, "MapServer"),      #  2,804 cadastre passports (86 fields)
    "LAND_1C":    ("1c_home_2026",                        0, "MapServer"),      #    370 land/home records (39 fields)
    # --- statistical reports ---
    "BOOK_REG":   ("hisobot/cadastral_book_by_region",    2, "MapServer"),      #    810 cadastral book by region
    "BOOK_DIS":   ("hisobot/data_v_cadastral_book_by_district", 0, "MapServer"),# 11,124 cadastral book by district
    "EIJARA":     ("hisobot/E_IJARA_SVOD_NEW",            0, "MapServer"),      #    206 e-ijara auction parcels
}

PAGE = 2000          # server maxRecordCount - do not raise
SLEEP = 0.25         # be polite to a public government server


def layer_url(name):
    svc, lid, kind = LAYERS[name]
    return f"{BASE}/{svc}/{kind}/{lid}"


def describe(name):
    r = requests.get(layer_url(name), params={"f": "json"}, timeout=60)
    r.raise_for_status()
    return r.json()


def count(name, where="1=1"):
    r = requests.get(layer_url(name) + "/query",
                     params={"where": where, "returnCountOnly": "true", "f": "json"}, timeout=60)
    j = r.json()
    return j.get("count")


def fetch(name, where="1=1", geometry=True, fields="*", out_sr=4326, verbose=True,
          simplify=None, precision=None):
    """Paginated pull. Yields feature dicts (ArcGIS JSON attributes + optional geometry).

    simplify   maxAllowableOffset in OUTPUT units (degrees when out_sr=4326).
               Server-side generalisation - measured on the MAHALLA layer:
                 none      98 MB      0.0001 (~11 m)  7.9 MB
                 0.0002     6.1 MB    0.0005 (~55 m)  3.3 MB
               Use ~0.0002 for web maps, none for analysis/area calculations.
    precision  geometryPrecision, decimal places. 6 ~= 0.1 m at this latitude.
    """
    url = layer_url(name) + "/query"
    offset, total = 0, 0
    while True:
        params = {
            "where": where, "outFields": fields,
            "returnGeometry": "true" if geometry else "false",
            "f": "geojson" if geometry else "json",
            "resultOffset": offset, "resultRecordCount": PAGE,
            "outSR": out_sr,
        }
        if simplify:
            params["maxAllowableOffset"] = simplify
        if precision:
            params["geometryPrecision"] = precision
        for attempt in range(4):
            try:
                r = requests.get(url, params=params, timeout=180)
                r.raise_for_status()
                j = r.json()
                break
            except Exception as e:
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
        if isinstance(j, dict) and j.get("error"):
            raise RuntimeError(j["error"])
        feats = j.get("features", [])
        if not feats:
            break
        for f in feats:
            yield f
        total += len(feats)
        if verbose:
            print(f"  {name}: {total} features", file=sys.stderr)
        if len(feats) < PAGE:
            break
        offset += PAGE
        time.sleep(SLEEP)


def to_geojson(name, path, **kw):
    feats = list(fetch(name, **kw))
    fc = {"type": "FeatureCollection",
          "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
          "features": feats}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(fc, fh, ensure_ascii=False)
    return len(feats)


def to_csv(name, path, **kw):
    kw["geometry"] = False
    rows, writer, fh, n = None, None, None, 0
    for f in fetch(name, **kw):
        a = f.get("attributes", f.get("properties", {}))
        if writer is None:
            fh = open(path, "w", newline="", encoding="utf-8")
            writer = csv.DictWriter(fh, fieldnames=list(a.keys()))
            writer.writeheader()
        writer.writerow(a)
        n += 1
    if fh:
        fh.close()
    return n


def to_postgis(name, dsn, table=None, **kw):
    import geopandas as gpd
    from sqlalchemy import create_engine
    feats = list(fetch(name, **kw))
    gdf = gpd.GeoDataFrame.from_features(feats, crs="EPSG:4326")
    gdf.to_postgis(table or name.lower(), create_engine(dsn), if_exists="replace", index=False)
    return len(gdf)


def main():
    p = argparse.ArgumentParser(description="NGIS (open.ngis.uz) extractor")
    p.add_argument("--list", action="store_true", help="list layers with live record counts")
    p.add_argument("--layer", help="layer key from --list")
    p.add_argument("--where", default="1=1", help="SQL filter, e.g. \"soato_region='1726'\"")
    p.add_argument("--fields", default="*")
    p.add_argument("--no-geometry", action="store_true")
    p.add_argument("--simplify", type=float, help="maxAllowableOffset in degrees, e.g. 0.0002 for web maps")
    p.add_argument("--precision", type=int, help="geometryPrecision, decimal places (6 ~= 0.1 m)")
    p.add_argument("--out", help="output .geojson or .csv")
    p.add_argument("--postgis", help="PostGIS DSN")
    p.add_argument("--schema", action="store_true", help="print field schema and exit")
    a = p.parse_args()

    if a.list:
        print(f"{'KEY':<12} {'COUNT':>10}  SERVICE")
        for k in LAYERS:
            try:
                c = count(k)
            except Exception as e:
                c = f"ERR"
            print(f"{k:<12} {str(c):>10}  {LAYERS[k][0]} ({LAYERS[k][2]})")
        return

    if not a.layer or a.layer not in LAYERS:
        p.error("--layer required; see --list")

    if a.schema:
        m = describe(a.layer)
        print(f"{a.layer}  geometry={m.get('geometryType')}  maxRecordCount={m.get('maxRecordCount')}")
        print(f"capabilities={m.get('capabilities')}")
        for f in m.get("fields", []):
            print(f"  {f['name']:<36} {f['type'].replace('esriFieldType','')}")
        return

    kw = dict(where=a.where, fields=a.fields, geometry=not a.no_geometry,
              simplify=a.simplify, precision=a.precision)
    if a.postgis:
        n = to_postgis(a.layer, a.postgis, **kw)
        print(f"wrote {n} rows to PostGIS")
    elif a.out and a.out.endswith(".csv"):
        n = to_csv(a.layer, a.out, where=a.where, fields=a.fields)
        print(f"wrote {n} rows -> {a.out}")
    elif a.out:
        n = to_geojson(a.layer, a.out, **kw)
        print(f"wrote {n} features -> {a.out}")
    else:
        p.error("--out or --postgis required")


if __name__ == "__main__":
    main()

```
