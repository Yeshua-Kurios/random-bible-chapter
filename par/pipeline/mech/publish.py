"""Join the smoothed text to the mechanical draft, run the gate, and write what the app and reviewers read.

Run: python par/pipeline/mech/publish.py "Jeremiah 3"
Needs par/mech/<slug>.final.json: {"by", "date", "method", "verses": [{"n", "final", "note", "rename"}]}.
That file is the smoothing stage's output: a free model, Claude, or a person fills it in from the draft in
par/mech/<slug>.json (the `literal` text and the `hints`). Nothing is written unless the gate has no errors.

Writes: par/mech/<slug>.json (draft + final), par/text/<slug>.json (what the app reads),
        par/review/<slug>.md (draft beside final, notes, gate warnings), par/progress.json (the chapter's entry).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import fetch  # noqa: E402
import gate  # noqa: E402
import render  # noqa: E402


def esc(s):
    return (s or "").replace("|", "\\|").replace("\n", " ")


def main(ref):
    book, chapter = fetch.split_ref(ref)
    slug = fetch.slug(book, chapter)
    mech_path = ROOT / "par" / "mech" / (slug + ".json")
    fin = json.loads((ROOT / "par" / "mech" / (slug + ".final.json")).read_text(encoding="utf8"))
    data = render.render(ref)                     # always re-render: the draft must match the current rules
    by_n = {v["n"]: v for v in fin["verses"]}
    for v in data["verses"]:
        f = by_n.get(v["n"], {})
        v["final"], v["note"], v["rename"] = f.get("final"), f.get("note"), f.get("rename") or {}
    data["smoothed"] = {k: fin.get(k) for k in ("by", "date", "method")}
    mech_path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    errors, warns = gate.check(slug)
    for e in errors:
        print("ERROR  ", e)
    for w in warns:
        print("warning", w)
    if errors:
        raise SystemExit("gate failed: nothing published")

    (ROOT / "par" / "text" / (slug + ".json")).write_text(json.dumps(
        {"book": book, "chapter": chapter, "verses": [v["final"] for v in data["verses"]]}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf8")

    lines = ["# %s %d (from the Hebrew)" % (book, chapter), "",
             "Source: %s" % data["source"], "",
             "Smoothed by: %s (%s). %s" % (fin.get("by"), fin.get("date"), fin.get("method")), "",
             "| v | Mechanical draft | Final | Notes |", "|---|---|---|---|"]
    for v in data["verses"]:
        notes = " ".join(x for x in [v["note"] or "", " ".join("_(draft %r became %r)_" % kv for kv in v["rename"].items())] if x)
        lines.append("| %d | %s | %s | %s |" % (v["n"], esc(v["literal"]), esc(v["final"]), esc(notes)))
    lines += ["", "## Gate", "", "Errors: none.", ""] + ["- check: " + w for w in warns]
    lines += ["", "## What the mechanical stage flagged", ""]
    for v in data["verses"]:
        for f in v["flags"]:
            lines.append("- v%d: %s" % (v["n"], f))
    (ROOT / "par" / "review" / (slug + ".md")).write_text("\n".join(lines) + "\n", encoding="utf8")

    prog_path = ROOT / "par" / "progress.json"
    prog = json.loads(prog_path.read_text(encoding="utf8"))
    prog["chapters"][slug] = {"date": fin.get("date"), "source": "from-hebrew", "drafters": ["mechanical (MACULA Hebrew + STEPBible gloss)"],
                              "review": "mechanical + %s" % ("claude-smoothed" if "Claude" in str(fin.get("by")) else "smoothed"),
                              "revised": []}
    prog.get("failed", {}).pop(slug, None)
    prog_path.write_text(json.dumps(prog, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    print("published %s: %d verses, %d warnings" % (slug, len(data["verses"]), len(warns)))


if __name__ == "__main__":
    main(" ".join(sys.argv[1:]))
