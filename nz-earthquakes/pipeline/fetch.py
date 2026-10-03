"""Download the GeoNet earthquake catalogue (M2.5+, 2000 onwards) into data/raw.

GeoNet's FDSN event service returns at most 10,000 events per request, so the
catalogue is fetched a year at a time, falling back to half-years for busy
years (2009-2011 and 2016). Also builds the NZ coastline from Natural Earth.

    python pipeline/fetch.py
"""
import datetime as dt
import gzip
import json
import urllib.error
import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
FDSN = "https://service.geonet.org.nz/fdsnws/event/1/query?format=text&minmagnitude=2.5&starttime={}&endtime={}"
ATLAS = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json"


def get(url):
    with urllib.request.urlopen(url, timeout=300) as r:
        return r.read().decode()


def fetch_range(start, end):
    try:
        return get(FDSN.format(start.isoformat(), end.isoformat())).splitlines()
    except urllib.error.HTTPError as e:
        if e.code != 413:                      # 413: more than 10,000 events
            raise
        mid = start + (end - start) / 2
        first = fetch_range(start, mid)
        return first + fetch_range(mid, end)[1:]   # drop the second header


def coastline():
    """New Zealand's polygons from Natural Earth (public domain), via world-atlas."""
    topo = json.loads(get(ATLAS))
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    nz = next(g for g in topo["objects"]["countries"]["geometries"] if g["properties"]["name"] == "New Zealand")
    polys = nz["arcs"] if nz["type"] == "MultiPolygon" else [nz["arcs"]]
    rings = []
    for poly in polys:
        ring = []
        for i in poly[0]:                       # outer ring only
            pts = arcs[i] if i >= 0 else arcs[~i][::-1]
            ring.extend(pts if not ring else pts[1:])
        lon = [p[0] % 360 for p in ring]
        lat = [p[1] for p in ring]
        if min(lat) > -48.5 and max(lat) < -33.5 and min(lon) > 164 and max(lon) < 180 and len(ring) > 8:
            rings.append([[round(a, 3), round(b, 3)] for a, b in zip(lon, lat)])
    (RAW / "nz-coastline.json").write_text(json.dumps(rings, separators=(",", ":")))
    print(f"coastline: {len(rings)} polygons")


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    today = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0)
    for year in range(2000, today.year + 1):
        start = dt.datetime(year, 1, 1)
        end = min(dt.datetime(year + 1, 1, 1), today)
        lines = fetch_range(start, end)
        with gzip.open(RAW / f"quakes_{year}.csv.gz", "wt") as f:
            f.write("\n".join(lines) + "\n")
        print(year, len(lines) - 1)
    coastline()


if __name__ == "__main__":
    main()
