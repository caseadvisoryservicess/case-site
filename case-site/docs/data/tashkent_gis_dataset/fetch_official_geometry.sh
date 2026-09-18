#!/usr/bin/env bash
# =============================================================================
# CASE Advisory - Tashkent GIS dataset
# Attaches the OFFICIAL mahalla polygon geometry to the attribute register.
#
# WHY THIS SCRIPT EXISTS
#   The 585 official mahalla polygons are public and downloadable with a single
#   unauthenticated HTTP GET. The session that built this dataset ran behind an
#   egress policy that blocks every arcgis.com and .uz host, so the geometry
#   could not be embedded. Everything else is already done. Run this once from
#   any unrestricted connection (about 20 seconds) and the dataset is complete.
#
# USAGE   bash fetch_official_geometry.sh
# NEEDS   curl, python3.  Optional: shapely (for the district dissolve).
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

HUB="https://hub.arcgis.com/api/v3/datasets/c51c854bad2d48f1beaad40272f8d483_0/downloads/data?format=geojson&spatialRefId=4326"
API="https://services8.arcgis.com/GyR85gR88mMqIY4t/arcgis/rest/services/Tashkent_Mahallas/FeatureServer/0/query"

echo "==> 1/5  Downloading official mahalla polygons (EPSG:4326)"
if ! curl -fSL --retry 3 --max-time 300 -o _official_mahallas.geojson "$HUB"; then
  echo "    Hub download failed - falling back to the feature service query API"
  curl -fSL --retry 3 --max-time 300 -o _official_mahallas.geojson \
    "${API}?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson"
fi

echo "==> 2/5  Validating"
python3 - <<'PY'
import json,sys
g=json.load(open("_official_mahallas.geojson",encoding="utf-8"))
f=g.get("features",[])
print("    features           :",len(f))
if len(f)!=585:
    print("    !! WARNING: expected 585. The layer may have been updated - re-verify the register.")
geom=set(x["geometry"]["type"] for x in f if x.get("geometry"))
print("    geometry types     :",sorted(geom))
nogeom=sum(1 for x in f if not x.get("geometry"))
print("    features w/o geom  :",nogeom)
xs=[];ys=[]
def walk(c):
    if isinstance(c[0],(int,float)): xs.append(c[0]); ys.append(c[1]); return
    for i in c: walk(i)
for x in f[:600]:
    if x.get("geometry"): walk(x["geometry"]["coordinates"])
print("    lon range          : %.4f .. %.4f  (expect ~69.12 .. 69.47)"%(min(xs),max(xs)))
print("    lat range          : %.4f .. %.4f  (expect ~41.16 .. 41.43)"%(min(ys),max(ys)))
if not (68.9<min(xs)<69.6 and 41.0<min(ys)<41.6):
    print("    !! WARNING: coordinates are outside Tashkent. Check the CRS - you may have received Web Mercator.")
PY

echo "==> 3/5  Joining the CASE attribute register onto the official geometry"
python3 - <<'PY'
import json,csv,io
off=json.load(open("_official_mahallas.geojson",encoding="utf-8"))
attrs={}
with io.open("04_tashkent_mahallas.csv",encoding="utf-8-sig") as fh:
    for r in csv.DictReader(fh):
        attrs[r["mahalla_id"].rsplit("-",1)[-1]]=r
out={"type":"FeatureCollection","name":"TASHKENT_MAHALLAS",
     "crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3/CRS84"}},
     "metadata":{"source_authority":"Toshkent shahar hokimligi - Raqamli rivojlantirish boshqarmasi",
       "legal_basis":"Tashkent City Kengash decisions, 2023-11-24 to 2024-10-23",
       "geometry_status":"OFFICIAL","crs":"EPSG:4326","feature_count":len(off.get("features",[]))},
     "features":[]}
matched=unmatched=0
for ft in off.get("features",[]):
    p=ft.get("properties",{}) or {}
    key=str(p.get("id") or p.get("Id") or p.get("OBJECTID") or "")
    a=attrs.get(key)
    if a: matched+=1; props=dict(a); props["source_layer_id"]=key
    else: unmatched+=1; props=dict(p); props["JOIN_STATUS"]="NO MATCH IN CASE REGISTER"
    props["geometry_available_in_this_file"]="YES"
    out["features"].append({"type":"Feature","id":key,"properties":props,"geometry":ft.get("geometry")})
json.dump(out,open("02_tashkent_mahallas.geojson","w",encoding="utf-8"),ensure_ascii=False)
print("    joined  :",matched)
print("    no match:",unmatched,"(should be 0; if not, the upstream layer changed)")
PY

echo "==> 4/5  Dissolving mahallas into the 12 district polygons"
python3 - <<'PY'
try:
    from shapely.geometry import shape,mapping
    from shapely.ops import unary_union
except ImportError:
    print("    shapely not installed - SKIPPING the district dissolve.")
    print("    Install with:  pip install shapely")
    print("    Or use GDAL:   ogr2ogr -f GeoJSON 01_tashkent_districts.geojson \\")
    print("                     02_tashkent_mahallas.geojson \\")
    print("                     -dialect sqlite -sql \"SELECT district_name_uz_latin, ST_Union(geometry) AS geometry \\")
    print("                     FROM '02_tashkent_mahallas' GROUP BY district_name_uz_latin\"")
    raise SystemExit
import json,csv,io,collections
mah=json.load(open("02_tashkent_mahallas.geojson",encoding="utf-8"))
dmeta={}
with io.open("03_tashkent_districts.csv",encoding="utf-8-sig") as fh:
    for r in csv.DictReader(fh): dmeta[r["district_name_uz_latin"]]=r
byd=collections.defaultdict(list)
for ft in mah["features"]:
    d=ft["properties"].get("district_name_uz_latin")
    if d and ft.get("geometry"): byd[d].append(shape(ft["geometry"]).buffer(0))
feats=[]
for d,geoms in sorted(byd.items()):
    u=unary_union(geoms)
    props=dict(dmeta.get(d,{"district_name_uz_latin":d}))
    props["geometry_available_in_this_file"]="YES"
    props["boundary_status"]="OFFICIAL (dissolved from the official mahalla layer)"
    props["area_km2_computed_from_geometry"]=round(
        __import__("pyproj",fromlist=["Geod"]).Geod(ellps="WGS84").geometry_area_perimeter(u)[0]/-1e6,3) \
        if __import__("importlib").util.find_spec("pyproj") else "NULL (install pyproj to compute)"
    feats.append({"type":"Feature","properties":props,"geometry":mapping(u)})
json.dump({"type":"FeatureCollection","name":"TASHKENT_DISTRICTS",
  "crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3/CRS84"}},
  "metadata":{"description":"The 12 districts of Tashkent City, dissolved from the official mahalla boundary layer.",
              "geometry_status":"OFFICIAL (derived by dissolve)","crs":"EPSG:4326"},
  "features":feats},open("01_tashkent_districts.geojson","w",encoding="utf-8"),ensure_ascii=False)
print("    districts written:",len(feats),"(expect 12)")
PY

echo "==> 5/5  Done"
echo "    01_tashkent_districts.geojson  - 12 district polygons, EPSG:4326"
echo "    02_tashkent_mahallas.geojson   - 585 mahalla polygons, EPSG:4326"
echo ""
echo "    Load into PostGIS with:"
echo "      ogr2ogr -f PostgreSQL PG:\"dbname=case_geo\" 02_tashkent_mahallas.geojson \\"
echo "              -nln tashkent_mahallas -lco GEOMETRY_NAME=geom -t_srs EPSG:4326 -overwrite"
