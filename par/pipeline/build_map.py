#!/usr/bin/env python3
"""Build map-data.js: the offline base map for the chapter map (land, lakes, rivers of the Bible lands).

Source: Natural Earth (public domain), 50m land, lakes and river centerlines, downloaded by the caller:
  curl -O https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
  (and ne_50m_lakes.geojson, ne_50m_rivers_lake_centerlines.geojson)
  python par/pipeline/build_map.py <dir with the three files> map-data.js

Standard library only. The output is one small JS file; the app draws it as inline SVG (no tiles, works offline).
"""
import json
import math
import sys
from pathlib import Path

LON0, LON1, LAT0, LAT1 = 8.0, 62.0, 10.0, 45.0  # Rome to the Persian Gulf, Nile to the Black Sea
SCALE = 80  # SVG units per degree of latitude
KX = math.cos(math.radians(31))  # shrink longitude so shapes look right at Bible latitudes
TOL = 0.012  # simplification tolerance in degrees (about 1.3 km)


def project(lon, lat):
    return ((lon - LON0) * KX * SCALE, (LAT1 - lat) * SCALE)


def clip_ring(ring):
    """Sutherland-Hodgman clip of a closed ring to the bounding box."""
    def clip(pts, inside, cut):
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cut(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cut(prev, cur))
        return out

    def vcut(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))

    def hcut(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)

    pts = [tuple(p[:2]) for p in ring]
    for inside, cut in ((lambda p: p[0] >= LON0, vcut(LON0)), (lambda p: p[0] <= LON1, vcut(LON1)),
                        (lambda p: p[1] >= LAT0, hcut(LAT0)), (lambda p: p[1] <= LAT1, hcut(LAT1))):
        if not pts:
            return []
        pts = clip(pts, inside, cut)
    return pts


def simplify(pts, tol):
    """Douglas-Peucker."""
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    idx, best = 0, -1.0
    for i in range(1, len(pts) - 1):
        if norm < 1e-12:  # a closed ring: measure from its start point instead
            d = math.hypot(pts[i][0] - x1, pts[i][1] - y1)
        else:
            d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / norm
        if d > best:
            idx, best = i, d
    if best > tol:
        return simplify(pts[:idx + 1], tol)[:-1] + simplify(pts[idx:], tol)
    return [pts[0], pts[-1]]


def path(pts, closed):
    pts = [(round(x), round(y)) for x, y in (project(*p) for p in pts)]
    dedup = [pts[0]] + [p for i, p in enumerate(pts[1:], 1) if p != pts[i - 1]]
    if len(dedup) < (3 if closed else 2):
        return ""
    s = "M%d %d" % dedup[0]
    for (px, py), (x, y) in zip(dedup, dedup[1:]):
        s += "l%d %d" % (x - px, y - py)
    return s + ("z" if closed else "")


def polygons(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def area_path(features, tol=TOL):
    out = []
    for f in features:
        for poly in polygons(f["geometry"]):
            for ring in poly:
                pts = clip_ring(ring)
                if len(pts) >= 3:
                    p = path(simplify(pts, tol), True)
                    if p:
                        out.append(p)
    return "".join(out)


def line_paths(features, names):
    out = []
    for f in features:
        if f["properties"].get("name") not in names:
            continue
        geom = f["geometry"]
        lines = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
        for line in lines:
            seg = []
            for lon, lat in (p[:2] for p in line):
                if LON0 <= lon <= LON1 and LAT0 <= lat <= LAT1:
                    seg.append((lon, lat))
                elif len(seg) > 1:
                    out.append(path(simplify(seg, TOL), False))
                    seg = []
                else:
                    seg = []
            if len(seg) > 1:
                out.append(path(simplify(seg, TOL), False))
    return [p for p in out if p]


def main():
    src, dest = Path(sys.argv[1]), Path(sys.argv[2])
    load = lambda n: json.loads((src / n).read_text(encoding="utf-8"))["features"]
    land = area_path(load("ne_50m_land.geojson"))
    lakes = area_path([f for f in load("ne_50m_lakes.geojson")
                       if f["properties"].get("name") in ("Dead Sea", "Sea of Galilee", "Lake Van", "Lake Urmia")], tol=0.002)
    rivers = line_paths(load("ne_50m_rivers_lake_centerlines.geojson"), {"Nile", "Tigris", "Euphrates", "Jordan"})
    meta = {"lon0": LON0, "lon1": LON1, "lat0": LAT0, "lat1": LAT1, "scale": SCALE, "kx": round(KX, 5),
            "land": land, "lakes": lakes, "rivers": rivers}
    dest.write_text("// Generated by par/pipeline/build_map.py from Natural Earth (public domain). Do not edit by hand.\n"
                    "const MAP_BASE = %s;\n" % json.dumps(meta, separators=(",", ":")), encoding="utf-8")
    print("wrote %s: land %d, lakes %d, rivers %d bytes" % (dest, len(land), len(lakes), sum(map(len, rivers))))


if __name__ == "__main__":
    main()
