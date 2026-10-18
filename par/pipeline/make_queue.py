#!/usr/bin/env python3
"""Write par/queue.json: one fixed random order of every chapter, shared by the app and the daily KJV27 run.

The app hands out the next unread chapter in this order (so it still feels random), and the pipeline
modernizes chapters in the same order, so KJV27 text is ready for the chapters you are about to read.
Run it once. Re-running with the same seed gives the same order; changing the seed reshuffles
everything, so don't once readers are partway through.

  python par/pipeline/make_queue.py [--seed N]
"""
import argparse
import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def all_keys():
    js = (ROOT / "data.js").read_text(encoding="utf-8")
    return ["%s %d" % (b, c) for b, n in re.findall(r'\["([^"]+)",\s*(\d+)\]', js) for c in range(1, int(n) + 1)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20261018)
    args = ap.parse_args()
    order = all_keys()
    random.Random(args.seed).shuffle(order)
    assert len(order) == len(set(order)) == 1189
    (ROOT / "par" / "queue.json").write_text(json.dumps({"seed": args.seed, "order": order}) + "\n", encoding="utf-8")
    print("wrote par/queue.json: %d chapters, first five: %s" % (len(order), ", ".join(order[:5])))


if __name__ == "__main__":
    main()
