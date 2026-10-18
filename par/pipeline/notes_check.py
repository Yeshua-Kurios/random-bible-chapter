#!/usr/bin/env python3
"""Validate the study notes in par/notes/ (the tap-for-more popups in the reader).

  python par/pipeline/notes_check.py

Each par/notes/<book>-<n>.json is {"chapter": "<book>-<n>", "notes": [note, ...]} and is listed in par/notes/index.json.
A note is {"v": verse, "match": [phrases], "kind": ..., "title": ..., "text": ..., "refs": [...], "source": "..."}.
"match" lists the words to make bold; the app tries each in turn, in the KJV27 text and in the KJV, so give the KJV27
wording first and the KJV wording second. This check fails if a note has no match in either text.

Kinds: word (rare word), variant (textual variant), ane (Ancient Near East), archaeology, extrabiblical, prophecy, canon.
Standard library only.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
KINDS = {"word", "variant", "ane", "archaeology", "extrabiblical", "prophecy", "canon"}
MAX_TEXT = 700


def verses(slug, ch):
    out = {}
    txt = ROOT / "par" / "text" / ("%s-%d.json" % (slug, ch))
    if txt.exists():
        out["KJV27"] = json.loads(txt.read_text(encoding="utf-8"))["verses"]
    kjv = ROOT / "kjv" / ("%s.json" % slug)
    if kjv.exists():
        out["KJV"] = json.loads(kjv.read_text(encoding="utf-8"))["chapters"][ch - 1]
    return out


def main():
    index = json.loads((ROOT / "par" / "notes" / "index.json").read_text(encoding="utf-8"))["chapters"]
    problems, total = [], 0
    files = sorted(p.stem for p in (ROOT / "par" / "notes").glob("*.json") if p.stem != "index")
    if sorted(index) != files:
        problems.append("index.json (%s) and the files (%s) disagree" % (index, files))
    for key in files:
        slug, ch = key.rsplit("-", 1)
        data = json.loads((ROOT / "par" / "notes" / (key + ".json")).read_text(encoding="utf-8"))
        texts = verses(slug, int(ch))
        if not texts:
            problems.append("%s: no text found" % key)
            continue
        for i, n in enumerate(data["notes"], 1):
            total += 1
            tag = "%s note %d (v%s)" % (key, i, n.get("v"))
            if n.get("kind") not in KINDS:
                problems.append("%s: unknown kind %r" % (tag, n.get("kind")))
            if not n.get("title") or not n.get("text"):
                problems.append("%s: needs a title and text" % tag)
            if len(n.get("text", "")) > MAX_TEXT:
                problems.append("%s: text over %d characters (a popup should be short)" % (tag, MAX_TEXT))
            if not isinstance(n.get("match"), list) or not n["match"]:
                problems.append("%s: needs a match list" % tag)
                continue
            found = {}
            for ver, vs in texts.items():
                if isinstance(n.get("v"), int) and 1 <= n["v"] <= len(vs):
                    text = re.sub(r"\[|\]", "", vs[n["v"] - 1])
                    found[ver] = any(m.lower() in text.lower() for m in n["match"])
            if not found.get("KJV27", False) and "KJV27" in texts:
                problems.append("%s: no match in the KJV27 text %s" % (tag, n["match"]))
            if not found.get("KJV", False):
                print("note: %s has no match in the KJV text (it will only be bold in KJV27)" % tag)
    print("%d notes in %d chapters" % (total, len(files)))
    for p in problems:
        print("PROBLEM:", p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
