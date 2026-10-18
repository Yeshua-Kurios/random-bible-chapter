#!/usr/bin/env python3
"""Daily KJV27 run: take the next chapters in the app's random order (par/queue.json), modernize them, and record the results.

Writes, for each chapter that drafts completely:
  par/text/<book>-<n>.json    the verses the app shows (only exists once the chapter is in the repo)
  par/review/<book>-<n>.md    KJV beside KJV27 plus the checkers' notes, for the person reviewing the PR
and updates par/progress.json, which the app reads to know which chapters have KJV27 text.
A chapter that cannot be drafted is retried on later days, and set aside after MAX_FAILURES.

  python par/pipeline/daily.py --count 5
"""
import argparse
import datetime
import json
import re
import sys
from pathlib import Path

import dryrun as d

MAX_FAILURES = 3  # tries per chapter before it is set aside
MAX_RUN_FAILURES = 3  # chapters that may fail in one run before it stops (a provider outage, not bad chapters)
PAR_DIR = d.ROOT / "par"


def slug(book):
    return re.sub(r"[^a-z0-9]+", "-", book.lower()).strip("-")


def canon():
    """Every (slug, chapter) in canonical order, read from data.js so there is one list of books."""
    js = (d.ROOT / "data.js").read_text(encoding="utf-8")
    return [(slug(b), c) for b, n in re.findall(r'\["([^"]+)",\s*(\d+)\]', js) for c in range(1, int(n) + 1)]


def key_to_chapter(key):
    """'1 John 2' (the app's key) -> ('1-john', 2)."""
    book, _, ch = key.rpartition(" ")
    return slug(book), int(ch)


def queue_order():
    """The chapters in the order the app will hand them out (par/queue.json); canonical order if it is missing."""
    try:
        order = json.loads((PAR_DIR / "queue.json").read_text(encoding="utf-8"))["order"]
        return [key_to_chapter(k) for k in order]
    except (OSError, ValueError, KeyError):
        d.log("par/queue.json not readable; using canonical order")
        return canon()


def already_read():
    """Chapters you have read, from the app's synced reading log, so the run starts at what is still unread.

    Optional: needs READING_LOG_TOKEN (a read-only token for the private repo the app syncs to) and
    READING_LOG_URL (its contents API URL for reading-log.json). Without them the run starts at the head of the queue.
    """
    import os
    import urllib.request
    token, url = os.environ.get("READING_LOG_TOKEN"), os.environ.get("READING_LOG_URL")
    if not token or not url:
        return set()
    try:
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token,
                                                   "Accept": "application/vnd.github.raw+json", "User-Agent": "par-daily"})
        with urllib.request.urlopen(req, timeout=30) as r:
            entries = json.load(r)
        read = {key_to_chapter(e["k"]) for e in entries if isinstance(e, dict) and isinstance(e.get("k"), str)}
        d.log("reading log: %d chapters already read" % len(read))
        return read
    except Exception as e:  # never let an unreachable log stop the run
        d.log("could not read the reading log (%s); starting at the head of the queue" % str(e)[:120])
        return set()


def load_progress():
    try:
        return json.loads((PAR_DIR / "progress.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"chapters": {}, "failed": {}}


def verdicts(rounds):
    last = rounds[-1] if rounds else []
    return {c["checker"]: c["verdict"] for c in last}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=5)
    ap.add_argument("--budget", type=int, default=2400, help="seconds for the whole run")
    ap.add_argument("--summary", default="par-out/summary.md")
    args = ap.parse_args()
    d.BUDGET = args.budget
    cfg = d.load_config()
    progress = load_progress()
    done, failed = progress["chapters"], progress.setdefault("failed", {})
    today = datetime.date.today().isoformat()

    read = already_read()
    queue = [(s, c) for s, c in queue_order()
             if (s, c) not in read and "%s-%d" % (s, c) not in done and failed.get("%s-%d" % (s, c), 0) < MAX_FAILURES]
    drafted, notes, failures = [], [], 0
    for s, c in queue:
        if len(drafted) >= args.count:
            break
        if failures >= MAX_RUN_FAILURES:
            notes.append("- stopped after %d failed chapters in this run; the providers may be down" % failures)
            break
        key = "%s-%d" % (s, c)
        d.log("== %s ==" % key)
        try:
            res = d.run_chapter(cfg, s, c)
        except Exception as e:  # a missing KJV file or a crash must not stop the other chapters
            res = {"complete": False, "md": "", "error": str(e)[:200]}
        if not res["complete"]:
            failures += 1
            failed[key] = failed.get(key, 0) + 1
            notes.append("- %s: not drafted (%s)" % (key, res.get("error", "a drafter chain failed"))
                         + (" - set aside after %d tries" % MAX_FAILURES if failed[key] >= MAX_FAILURES else ""))
            continue
        failed.pop(key, None)
        (PAR_DIR / "text").mkdir(exist_ok=True)
        (PAR_DIR / "review").mkdir(exist_ok=True)
        (PAR_DIR / "text" / (key + ".json")).write_text(json.dumps(
            {"book": res["book"], "chapter": c, "verses": [v["text"] for v in res["verses"]]},
            ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        (PAR_DIR / "review" / (key + ".md")).write_text(res["md"], encoding="utf-8")
        done[key] = {"date": today, "drafters": res["drafters"], "revised": res["revised"], **verdicts(res["rounds"])}
        drafted.append(key)

    progress["updated"] = today
    (PAR_DIR / "progress.json").write_text(json.dumps(progress, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    if d.USAGE:
        d.save_usage(PAR_DIR / "usage.json")

    lines = ["KJV27 chapters for %s: %d of %d drafted. %d of %d chapters done in all." % (
        today, len(drafted), args.count, len(done), len(canon())), ""]
    for key in drafted:
        v = {k: x for k, x in done[key].items() if k in ("review", "fidelity", "style")}
        lines.append("- %s: %s%s" % (key, ", ".join("%s %s" % kv for kv in v.items()),
                                     ", revised verses %s" % done[key]["revised"] if done[key]["revised"] else ""))
    lines += notes + ["", "Review KJV against KJV27 in `par/review/`. Merging this PR is the approval: the app shows these chapters "
                      "only once they are on main, and shows the KJV for every other chapter."]
    Path(args.summary).parent.mkdir(parents=True, exist_ok=True)
    Path(args.summary).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    sys.exit(0 if drafted else 1)


if __name__ == "__main__":
    main()
