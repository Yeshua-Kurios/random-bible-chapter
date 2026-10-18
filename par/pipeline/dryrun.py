#!/usr/bin/env python3
"""PAR dry run: draft one chapter from the Hebrew (WLC), then have checkers review it.

Standard library only. Providers whose key env var is unset are skipped.
Keys are never printed.

  python par/pipeline/dryrun.py --list-models
  python par/pipeline/dryrun.py --book Ps --chapter 23
"""
import argparse
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
OSIS = "{http://www.bibletechnologies.net/2003/OSIS/namespace}"
WLC_URL = "https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/{book}.xml"

GLOSS_SYSTEM = (
    "You gloss biblical Hebrew one word at a time. Each input line is an id and one Hebrew word. "
    "Give a short literal English gloss for every word, in order, using only what the word means. "
    "Do not write sentences and do not recall any English Bible. "
    'Reply with JSON only: {"words":[{"id":"<id>","gloss":"<gloss>"}]} with exactly one entry per input id.'
)
TRANSLATE_SYSTEM = (
    "You build English verses from word glosses of biblical Hebrew. You never see the Hebrew or any English Bible. "
    "Use only the glosses: every content word in your English must come from a gloss, and you may add only "
    "function words (articles, prepositions, auxiliaries) that English grammar needs. Do not use remembered "
    "Bible wording that the glosses do not support. Keep every verse, in order. "
    'Reply with JSON only: {"verses":[{"n":<verse number>,"translation":"<English>"}]}.'
)
REVISE_SYSTEM = (
    "You revise English verses built from word glosses of biblical Hebrew. You never see the Hebrew or any "
    "English Bible. For each verse you get its glosses, the current English, and reviewers' issues. Fix the "
    "problems the issues describe. An issue may show that a gloss was misread (for example a conjunction or a "
    "subject); follow the issue's reading of the Hebrew, and change nothing else. "
    'Reply with JSON only: {"verses":[{"n":<verse number>,"translation":"<English>"}]} for the listed verses only.'
)
CHUNK = 6  # verses per model call
CHECK_FOCUS = {
    "lexical": "Check that each Hebrew word is rendered with a defensible sense, and that no word is dropped or invented.",
    "meaning": "Check that the English conveys the meaning of the Hebrew clause, including syntax, tense and idiom.",
    "style": "Check that the English is clear, consistent and free of padding, without changing the meaning.",
}
CHECK_SYSTEM = (
    "You review an English draft against its Hebrew source. {focus} "
    'Reply with JSON only: {{"verdict":"pass"|"fail","issues":[{{"verse":<n>,"problem":"...","suggestion":"..."}}]}}.'
)


def load_config():
    return json.loads((HERE / "config.json").read_text(encoding="utf-8"))


def expand(url):
    """Expand {VAR} placeholders from the environment; None if one is unset."""
    missing = []

    def sub(m):
        val = os.environ.get(m.group(1))
        if not val:
            missing.append(m.group(1))
        return val or ""

    out = re.sub(r"\{([A-Z0-9_]+)\}", sub, url)
    return None if missing else out


def provider(cfg, name):
    """Return (base_url, key, model) or None when the provider cannot be used."""
    p = cfg["providers"].get(name)
    if not p:
        return None
    key = os.environ.get(p["key_env"])
    base = expand(p["base_url"])
    if not key or not base:
        return None
    return base.rstrip("/"), key, p["model"]


def http(url, key, body=None, timeout=240, retries=3):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "User-Agent": "par-dryrun",
    })
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(5 * 2 ** attempt)  # rate limits on free tiers
                continue
            raise RuntimeError("HTTP %d from %s: %s" % (e.code, url, e.read()[:300].decode("utf-8", "replace")))
        except (TimeoutError, urllib.error.URLError) as e:
            if attempt < retries:
                time.sleep(5)
                continue
            raise RuntimeError("no response from %s: %s" % (url, e))


USAGE = {}  # provider -> token counts for this run


def record_usage(name, res):
    u = res.get("usage") or {}
    t = USAGE.setdefault(name, {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})
    t["calls"] += 1
    t["prompt_tokens"] += int(u.get("prompt_tokens") or 0)
    t["completion_tokens"] += int(u.get("completion_tokens") or 0)
    t["total_tokens"] += int(u.get("total_tokens") or 0) or int(u.get("prompt_tokens") or 0) + int(u.get("completion_tokens") or 0)


def save_usage(path):
    """Add this run's tokens to the running ledger the app's LLM Usage page reads."""
    path = Path(path)
    try:
        ledger = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        ledger = {}
    provs = ledger.setdefault("providers", {})
    for name, t in USAGE.items():
        cur = provs.setdefault(name, {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})
        for k, v in t.items():
            cur[k] += v
    ledger["total_tokens"] = sum(p["total_tokens"] for p in provs.values())
    ledger["updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    path.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")


def chat(name, prov, system, user):
    base, key, model = prov
    res = http(base + "/chat/completions", key, {
        "model": model,
        "temperature": 0.2,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    })
    record_usage(name, res)
    return res["choices"][0]["message"]["content"]


def parse_json(text):
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except ValueError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise
        return json.loads(m.group(0))


def list_models(cfg):
    for name in cfg["providers"]:
        prov = provider(cfg, name)
        if not prov:
            print("%s: skipped (key or URL variable unset)" % name)
            continue
        base, key, _ = prov
        try:
            data = http(base + "/models", key)
            items = data.get("data", data) if isinstance(data, dict) else data
            ids = sorted(str(m.get("id", m.get("name", ""))) if isinstance(m, dict) else str(m) for m in items)
            print("%s: %d models" % (name, len(ids)))
            for i in ids:
                print("  " + i)
        except Exception as e:
            print("%s: error: %s" % (name, str(e)[:200]))


def fetch_chapter(book, chapter):
    """Return ([(verse, hebrew_text)], {verse: [word, ...]}) for one chapter of the WLC (OSIS)."""
    with urllib.request.urlopen(WLC_URL.format(book=book), timeout=60) as r:
        root = ET.parse(r).getroot()
    verses, words = [], {}
    for v in root.iter(OSIS + "verse"):
        parts = (v.get("osisID") or "").split(".")
        if len(parts) != 3 or parts[1] != str(chapter):
            continue
        n = int(parts[2])
        words[n] = ["".join(w.itertext()).replace("/", "") for w in v.iter(OSIS + "w")]
        verses.append((n, " ".join(words[n])))
    if not verses:
        raise SystemExit("no verses found for %s %s" % (book, chapter))
    return verses, words


def source_block(verses):
    return "\n".join("%d %s" % (n, t) for n, t in verses)


def word_lines(words):
    return "\n".join("%d.%d %s" % (n, i + 1, w) for n, ws in words.items() for i, w in enumerate(ws))


def gate_glosses(words, out):
    """Every source word gets exactly one non-empty gloss, and nothing else is glossed."""
    want = ["%d.%d" % (n, i + 1) for n, ws in words.items() for i, _ in enumerate(ws)]
    got = [str(w.get("id")) for w in out["words"]]
    if sorted(got) != sorted(want):
        raise ValueError("glosses cover %d ids, source has %d (missing %s)" % (
            len(set(got)), len(want), sorted(set(want) - set(got))[:5]))
    glosses = {str(w["id"]): str(w.get("gloss", "")).strip() for w in out["words"]}
    empty = [i for i, g in glosses.items() if not g]
    if empty:
        raise ValueError("empty glosses: %s" % empty[:5])
    return glosses


def chunks(verses, size=CHUNK):
    return [verses[i:i + size] for i in range(0, len(verses), size)]


def draft_chunk(cfg, part, words, skip=()):
    """Gloss, gate, then translate one chunk of verses; try each drafter in turn."""
    cw = {n: words[n] for n, _ in part}
    for name in cfg["drafters"]:
        prov = provider(cfg, name)
        if not prov or name in skip:
            print("drafter %s: skipped" % name, file=sys.stderr)
            continue
        try:
            glosses = gate_glosses(cw, parse_json(chat(name, prov, GLOSS_SYSTEM, word_lines(cw))))
            gloss_text = "\n".join("%d: %s" % (n, " | ".join(glosses["%d.%d" % (n, i + 1)] for i, _ in enumerate(ws)))
                                   for n, ws in cw.items())
            out = parse_json(chat(name, prov, TRANSLATE_SYSTEM, gloss_text))
            got = [int(v["n"]) for v in out["verses"]]
            if got != [n for n, _ in part]:
                raise ValueError("verse numbers %s do not match the source" % got)
            return name, prov[2], [{"n": int(v["n"]),
                                    "gloss": " | ".join(glosses["%d.%d" % (v["n"], i + 1)] for i, _ in enumerate(cw[int(v["n"])])),
                                    "translation": v["translation"]} for v in out["verses"]]
        except Exception as e:
            print("drafter %s failed on verses %d-%d: %s" % (name, part[0][0], part[-1][0], str(e)[:300]), file=sys.stderr)
    return None


def draft(cfg, verses, words):
    """Draft the chapter chunk by chunk. Returns (providers used, [verse dicts]) or None."""
    drafted, used = [], []
    for part in chunks(verses):
        res = draft_chunk(cfg, part, words)
        if not res:
            return None
        used.append("%s (%s)" % res[:2])
        drafted += res[2]
    return sorted(set(used)), drafted


def revise(cfg, drafted, checks):
    """One revision pass: give each flagged verse's glosses and issues back to a drafter."""
    issues = {}
    for c in checks:
        for i in c["issues"]:
            try:
                issues.setdefault(int(i.get("verse")), []).append("%s: %s -> %s" % (c["checker"], i.get("problem"), i.get("suggestion")))
            except (TypeError, ValueError):
                pass
    flagged = [v for v in drafted if v["n"] in issues]
    if not flagged:
        return drafted, []
    user = "\n\n".join("Verse %d\nGlosses: %s\nCurrent English: %s\nIssues:\n- %s" % (
        v["n"], v["gloss"], v["translation"], "\n- ".join(issues[v["n"]])) for v in flagged)
    for name in cfg["drafters"]:
        prov = provider(cfg, name)
        if not prov:
            continue
        try:
            out = {int(v["n"]): v["translation"] for v in parse_json(chat(name, prov, REVISE_SYSTEM, user))["verses"]}
            if not set(out) <= set(issues):
                raise ValueError("revised verses %s were not flagged" % sorted(out))
            return [dict(v, translation=out.get(v["n"], v["translation"]), first=v["translation"] if v["n"] in out else None)
                    for v in drafted], sorted(out)
        except Exception as e:
            print("reviser %s failed: %s" % (name, str(e)[:300]), file=sys.stderr)
    return drafted, []


def check(cfg, kind, verses, drafted):
    name = cfg["checkers"][kind]
    prov = provider(cfg, name)
    if not prov:
        return {"checker": kind, "provider": name, "verdict": "skipped", "issues": []}
    user = "HEBREW:\n%s\n\nDRAFT:\n%s" % (source_block(verses), json.dumps(drafted, ensure_ascii=False))
    try:
        out = parse_json(chat(name, prov, CHECK_SYSTEM.format(focus=CHECK_FOCUS[kind]), user))
        return {"checker": kind, "provider": name, "model": prov[2],
                "verdict": out.get("verdict", "unknown"), "issues": out.get("issues", [])}
    except Exception as e:
        return {"checker": kind, "provider": name, "verdict": "error", "issues": [], "error": str(e)[:200]}


def render(book, chapter, verses, used, drafted, rounds, revised):
    src = dict(verses)
    lines = ["# %s %s (dry run)" % (book, chapter), "",
             "Drafters: %s" % (", ".join(used) if used else "none (all failed)"), "",
             "Hebrew psalm numbering: titles count as verse 1.", "",
             "| v | Hebrew | Gloss | Translation |", "|---|---|---|---|"]
    for v in drafted:
        t = v.get("translation", "")
        if v.get("first"):
            t += " _(revised; first draft: %s)_" % v["first"]
        lines.append("| %s | %s | %s | %s |" % (v["n"], src.get(int(v["n"]), ""), v.get("gloss", ""), t))
    for k, checks in enumerate(rounds, 1):
        lines += ["", "## Checks, round %d%s" % (k, "" if k == 1 else " (after revising verses %s)" % ", ".join(map(str, revised))), ""]
        for c in checks:
            lines.append("- **%s** (%s): %s%s" % (c["checker"], c["provider"], c["verdict"],
                                                 " - " + c["error"] if c.get("error") else ""))
            for i in c["issues"]:
                lines.append("  - v%s: %s -> %s" % (i.get("verse"), i.get("problem"), i.get("suggestion")))
    lines += ["", "_Agreement among models is evidence, not proof. A person reviews before this is called a translation._"]
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-models", action="store_true")
    ap.add_argument("--book", default="Ps", help="morphhb file stem, e.g. Ps, Gen")
    ap.add_argument("--chapter", type=int, default=23)
    ap.add_argument("--out", default="par-out")
    ap.add_argument("--usage", default=str(HERE.parent / "usage.json"), help="token ledger to update")
    args = ap.parse_args()
    cfg = load_config()

    if args.list_models:
        list_models(cfg)
        return

    verses, words = fetch_chapter(args.book, args.chapter)
    res = draft(cfg, verses, words)
    used, drafted = res if res else ([], [])
    rounds, revised = [], []
    if drafted:
        rounds.append([check(cfg, k, verses, drafted) for k in cfg["checkers"]])
        if any(c["issues"] for c in rounds[0]):
            drafted, revised = revise(cfg, drafted, rounds[0])
            if revised:
                rounds.append([check(cfg, k, verses, drafted) for k in cfg["checkers"]])
    md = render(args.book, args.chapter, verses, used, drafted, rounds, revised)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stem = "%s-%s" % (args.book, args.chapter)
    (out / (stem + ".md")).write_text(md, encoding="utf-8")
    (out / (stem + ".json")).write_text(json.dumps(
        {"book": args.book, "chapter": args.chapter, "source": verses, "drafters": used,
         "verses": drafted, "revised": revised, "checks": rounds},
        ensure_ascii=False, indent=2), encoding="utf-8")
    if USAGE:
        save_usage(args.usage)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(md)
    print(md)


if __name__ == "__main__":
    main()
