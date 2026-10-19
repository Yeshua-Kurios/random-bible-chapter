"""Deterministic gate for the from-source track. It judges the smoothed text; it never calls a model.

Checks, per chapter (par/mech/<slug>.json after smoothing fills each verse's `final`):
  errors   - a verse has no final text; archaic English; [brackets]; the verse count differs from the English
             versification in kjv/ (the app and the reading log count verses that way); a proper name, number or
             LORD in the mechanical draft is missing from the final text; the draft did not account for every word
  warnings - the final text shares long runs of words with the KJV (the from-source track must not lean on it)
Warnings go to the reviewer in par/review/; errors send the verse back to the smoother.

Run: python par/pipeline/mech/gate.py jeremiah-3
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE.parent))
import rules  # noqa: E402  (ARCHAIC, ETH, EST word lists shared with the KJV27 gate)

KJV_RUN = 5          # a shared run of this many words is flagged
KJV_SHARE = 0.5      # share of a verse's words covered by shared 4-word runs that makes it a warning on its own


def words(s):
    """Lowercase word list; a possessive counts as the name itself (Israel's -> israel)."""
    found = re.findall(r"[a-z0-9']+", s.lower().replace("’", "'"))
    return [w[:-2] if w.endswith("'s") else w for w in found]


def runs(a, b, n):
    """Positions in a covered by an n-word run that also occurs in b."""
    grams = {tuple(b[i:i + n]) for i in range(len(b) - n + 1)}
    cover = set()
    for i in range(len(a) - n + 1):
        if tuple(a[i:i + n]) in grams:
            cover.update(range(i, i + n))
    return cover


def kjv_verses(slug):
    book, ch = slug.rsplit("-", 1)
    path = ROOT / "kjv" / (book + ".json")
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf8"))["chapters"][int(ch) - 1]


def check(slug):
    data = json.loads((ROOT / "par" / "mech" / (slug + ".json")).read_text(encoding="utf8"))
    errors, warns = [], []
    cov = data["coverage"]
    if not cov["visited_once"] or cov["missing"] or cov["visited"] != cov["words"]:
        errors.append("chapter: the draft did not account for every source word once (%s)" % cov)
    if cov.get("no_gloss"):
        warns.append("chapter: %d words had no lexicon gloss and show as [transliteration]" % len(cov["no_gloss"]))
    kjv = kjv_verses(slug)
    if kjv is not None and len(kjv) != len(data["verses"]):
        errors.append("chapter: %d verses in the source but %d in the English versification" % (len(data["verses"]), len(kjv)))
    for v in data["verses"]:
        n, lit, fin = v["n"], v["literal"], (v.get("final") or "").strip()
        tag = "v%d" % n
        if not fin:
            errors.append("%s: no final text" % tag)
            continue
        if re.search(r"[\[\]]", fin):
            errors.append("%s: [brackets] in the text" % tag)
        for pat in (rules.ARCHAIC, rules.EST):
            m = pat.search(fin)
            if m:
                errors.append("%s: archaic word %r" % (tag, m.group(0)))
        for m in rules.ETH.finditer(fin):
            if m.group(0).lower() not in rules.ETH_OK:
                errors.append("%s: archaic verb ending %r" % (tag, m.group(0)))
        low = set(words(fin))
        rename = v.get("rename", {})                    # draft word -> what the smoother used instead, with a note
        for w in v.get("keep", []):                      # proper names and numbers from the source words
            if w.lower() not in low and not rename.get(w):
                errors.append("%s: %r from the source is missing (or add it to rename with the replacement)" % (tag, w))
        if "LORD" in lit.split() and "LORD" not in fin:
            errors.append("%s: LORD is missing" % tag)
        if kjv is not None and n <= len(kjv):
            a, b = words(fin), words(re.sub(r"[\[\]#]", "", kjv[n - 1]))
            long_run = runs(a, b, KJV_RUN)
            share = len(runs(a, b, 4)) / max(1, len(a))
            if long_run:
                warns.append("%s: shares a run of %d+ words with the KJV: %s" % (
                    tag, KJV_RUN, " ".join(a[i] for i in sorted(long_run))[:80]))
            elif share >= KJV_SHARE:
                warns.append("%s: %d%% of the words sit in 4-word runs shared with the KJV" % (tag, round(share * 100)))
    return errors, warns


if __name__ == "__main__":
    errs, warns = check(sys.argv[1])
    for e in errs:
        print("ERROR  ", e)
    for w in warns:
        print("warning", w)
    print("%d errors, %d warnings" % (len(errs), len(warns)))
    sys.exit(1 if errs else 0)
