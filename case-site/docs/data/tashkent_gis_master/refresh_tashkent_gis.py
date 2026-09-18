#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
refresh_tashkent_gis.py  -- CASE Advisory / Tashkent geoanalytics

Re-pulls the OFFICIAL Tashkent City administrative dataset at FULL precision,
straight from the Uzbek Cadastre Agency's public services.

  * districts : db.ngis.uz  Hosted/TUMAN_BORDER       (12 polygons)
  * mahallas  : db.ngis.uz  UZKAD/MAHALLA_UZKAD_DB16  (polygons, 402 as of 2026-09-18)
  * register  : api-etirof.kadastr.uz                 (585 MFY names + SOATO codes)

MUST be run from a network that can reach *.ngis.uz and *.kadastr.uz
(i.e. from Uzbekistan or an unrestricted connection).

    pip install requests
    python3 refresh_tashkent_gis.py --out ./data

Outputs GeoJSON (EPSG:4326) + CSV. No simplification is applied.
"""
import argparse, json, csv, sys, time
import requests

NGIS = "https://db.ngis.uz/db/rest/services"
MAHALLA = f"{NGIS}/UZKAD/MAHALLA_UZKAD_DB16/FeatureServer/0/query"
TUMAN   = f"{NGIS}/Hosted/TUMAN_BORDER/FeatureServer/2/query"
ETIROF  = "https://api-etirof.kadastr.uz/api/v1/commons/selects/neighborhoods"

CITY_SOATO = "1726"                      # Toshkent shahri  (1727 = Toshkent VILOYATI - do not confuse)
DISTRICTS = {                            # cadastre prefix -> SOATO
    "10:01":"1726262","10:02":"1726264","10:03":"1726294","10:04":"1726290",
    "10:05":"1726287","10:06":"1726283","10:07":"1726266","10:08":"1726280",
    "10:09":"1726269","10:10":"1726277","10:11":"1726273","10:12":"1726292"}
NAMES = {
    "1726262":"Uchtepa tumani","1726264":"Bektemir tumani","1726266":"Yunusobod tumani",
    "1726269":"Mirzo Ulugʻbek tumani","1726273":"Mirobod tumani","1726277":"Shayxontohur tumani",
    "1726280":"Olmazor tumani","1726283":"Sergeli tumani","1726287":"Yakkasaroy tumani",
    "1726290":"Yashnobod tumani","1726292":"Yangihayot tumani","1726294":"Chilonzor tumani"}


def get(url, params, tries=4):
    for i in range(tries):
        try:
            r = requests.get(url, params=params, timeout=120)
            r.raise_for_status()
            j = r.json()
            if isinstance(j, dict) and "error" in j:
                raise RuntimeError(j["error"])
            return j
        except Exception as e:
            if i == tries - 1:
                raise
            print(f"   retry {i+1}: {e}", file=sys.stderr)
            time.sleep(3 * (i + 1))


def esri_to_geojson(geom):
    """Esri polygon rings -> GeoJSON. Esri: clockwise = exterior, ccw = hole."""
    def signed(r):
        s = 0.0
        for i in range(len(r) - 1):
            s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
        return s / 2

    def close(r):
        r = [list(p[:2]) for p in r]
        if r[0] != r[-1]:
            r.append(list(r[0]))
        return r

    ext, holes = [], []
    for r in geom.get("rings", []):
        r = close(r)
        (holes if signed(r) > 0 else ext).append(r)
    if not ext:                       # defensive: treat everything as exterior
        ext, holes = holes, []
    parts = []
    for e in ext:
        if signed(e) < 0:
            e = e[::-1]               # RFC 7946: exterior counter-clockwise
        ring_holes = []
        for h in holes:
            if signed(h) > 0:
                h = h[::-1]           # holes clockwise
            ring_holes.append(h)
        parts.append([e] + (ring_holes if len(ext) == 1 else []))
    return ({"type": "Polygon", "coordinates": parts[0]} if len(parts) == 1
            else {"type": "MultiPolygon", "coordinates": parts})


def page_query(url, where, out_fields):
    """Paged ArcGIS query, full precision, WGS84."""
    feats, offset, page = [], 0, 1000
    while True:
        j = get(url, {"where": where, "outFields": out_fields, "returnGeometry": "true",
                      "outSR": 4326, "f": "json",
                      "resultOffset": offset, "resultRecordCount": page})
        got = j.get("features", [])
        feats += got
        if len(got) < page and not j.get("exceededTransferLimit"):
            break
        offset += len(got)
        if not got:
            break
    return feats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=".")
    a = ap.parse_args()
    today = time.strftime("%Y-%m-%d")

    print("1/3  official MFY register (etirof) ...")
    reg, p = {}, 1
    while True:
        j = get(ETIROF, {"page": p, "limit": 1000})
        lst = j.get("neighborhoodsList", [])
        for n in lst:
            s = str(n["soato"])
            if s[:7] in NAMES:
                reg[s] = n["name"].replace(" MFY", "")
        if len(lst) < 1000:
            break
        p += 1
    print(f"     {len(reg)} Tashkent mahallas in the official register")

    print("2/3  district polygons ...")
    df = page_query(TUMAN, "region LIKE '%oshkent shahri%'", "prefix,region,district,st_area_sh")
    dfeat = []
    for f in df:
        at = f["attributes"]
        so = DISTRICTS.get(at.get("prefix"), "UNKNOWN")
        dfeat.append({"type": "Feature", "properties": {
            "district_id": so, "soato_code": so,
            "district_name_uz_latin": NAMES.get(so, at.get("district")),
            "cadastre_prefix": at.get("prefix"), "parent_city": "Toshkent shahri",
            "geometry_status": "OFFICIAL", "source": "Kadastr agentligi open.ngis.uz Hosted/TUMAN_BORDER",
            "extracted_date": today,
            "warning_st_area_sh": "Web-Mercator area, inflated ~1.772x at this latitude - recompute geodesically"},
            "geometry": esri_to_geojson(f["geometry"])})
    print(f"     {len(dfeat)} districts")

    print("3/3  mahalla polygons ...")
    mf = page_query(MAHALLA, f"soato_region='{CITY_SOATO}'",
                    "cadastral_number,mahalla_name,district_name,soato_district,create_at,modify_at")
    mfeat = []
    for f in mf:
        at = f["attributes"]
        code = at.get("cadastral_number")
        mfeat.append({"type": "Feature", "properties": {
            "mahalla_id": code, "soato_code": code,
            "mahalla_name_uz_latin": reg.get(code, at.get("mahalla_name")),
            "mahalla_name_cadastre": at.get("mahalla_name"),
            "district_id": at.get("soato_district"),
            "district_name_uz_latin": NAMES.get(at.get("soato_district"), at.get("district_name")),
            "parent_city": "Toshkent shahri", "geometry_status": "OFFICIAL",
            "source": "Kadastr agentligi open.ngis.uz UZKAD/MAHALLA_UZKAD_DB16",
            "extracted_date": today},
            "geometry": esri_to_geojson(f["geometry"])})
    print(f"     {len(mfeat)} mahalla polygons  ({len(mfeat)}/{len(reg)} = "
          f"{100*len(mfeat)/max(len(reg),1):.1f}% of the register)")

    for name, obj in (("01_tashkent_districts.geojson", dfeat),
                      ("02_tashkent_mahallas.geojson", mfeat)):
        json.dump({"type": "FeatureCollection",
                   "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
                   "features": obj},
                  open(f"{a.out}/{name}", "w", encoding="utf-8"), ensure_ascii=False)
        print(f"     wrote {name}")

    have = {f["properties"]["mahalla_id"] for f in mfeat}
    with open(f"{a.out}/04_tashkent_mahallas.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["soato_code", "mahalla_name_uz_latin", "district_id",
                    "district_name_uz_latin", "has_official_polygon", "extracted_date"])
        for s in sorted(reg):
            w.writerow([s, reg[s], s[:7], NAMES[s[:7]], "YES" if s in have else "NO", today])
    print("     wrote 04_tashkent_mahallas.csv")
    print("\nDone. CHECK: if the polygon count has risen above 402, coverage is improving.")


if __name__ == "__main__":
    main()
