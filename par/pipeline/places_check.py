#!/usr/bin/env python3
"""Check places.js (the gazetteer behind the chapter map) and report how much of the Bible it covers.

  python par/pipeline/places_check.py          # validate and print coverage
  python par/pipeline/places_check.py --top 40  # also list the most-mentioned mapped places

Standard library only.
"""
import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ENTRY = re.compile(r'^\s*\["([^"]+)",\s*"([cmr])",\s*(-?[\d.]+),\s*(-?[\d.]+),\s*"([^"]*)",\s*"([^"]*)"\],?\s*(//.*)?$')


def load_places():
    places = []
    for n, line in enumerate((ROOT / "places.js").read_text(encoding="utf-8").splitlines(), 1):
        s = line.strip()
        if not s.startswith('["'):
            continue
        m = ENTRY.match(line)
        if not m:
            raise SystemExit("places.js line %d is not a valid entry: %s" % (n, s))
        names, kind, lat, lon, modern, flags = m.groups()[:6]
        places.append({"names": names.split("|"), "kind": kind, "lat": float(lat), "lon": float(lon), "modern": modern, "flags": flags})
    return places


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=0)
    args = ap.parse_args()
    places = load_places()
    problems, seen = [], {}
    for p in places:
        if not (8 <= p["lon"] <= 62 and 10 <= p["lat"] <= 45):
            problems.append("%s is outside the base map (%s, %s)" % (p["names"][0], p["lat"], p["lon"]))
        for name in p["names"]:
            if name in seen:
                problems.append("%s is listed twice (%s and %s)" % (name, seen[name], p["names"][0]))
            seen[name] = p["names"][0]
    name_re = re.compile(r"\b(%s)\b" % "|".join(sorted((re.escape(n) for n in seen), key=len, reverse=True)))
    chapters = hits = 0
    counts = collections.Counter()
    for f in sorted((ROOT / "kjv").glob("*.json")):
        book = json.loads(f.read_text(encoding="utf-8"))
        for ch in book["chapters"]:
            chapters += 1
            found = {seen[m.group(1)] for v in ch for m in name_re.finditer(v)}
            counts.update(found)
            if any(next(q for q in places if q["names"][0] == n)["kind"] in "cm" for n in found):
                hits += 1
    print("%d places (%d cities, %d mountains, %d lands)" % (len(places), *(sum(p["kind"] == k for p in places) for k in "cmr")))
    print("%d of %d chapters mention at least one mapped city or mountain" % (hits, chapters))
    for name, n in counts.most_common(args.top):
        print("  %4d chapters  %s" % (n, name))
    for p in problems:
        print("PROBLEM:", p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
