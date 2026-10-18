#!/usr/bin/env python3
"""PAR dry run: modernize one KJV chapter, gate it, have checkers review it, revise once.

PAR is a light modernization of the KJV (see par/STYLE.md), not a new translation.
Standard library only. Providers whose key env var is unset are skipped.
Keys are never printed.

  python par/pipeline/dryrun.py --list-models
  python par/pipeline/dryrun.py --book psalms --chapter 23
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
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CHUNK = 12  # verses per model call

DRAFT_SYSTEM = (
    "You modernize the English of the King James Version according to the style guide below. "
    "You are not retranslating: keep the meaning, verse order and sentence rhythm of the KJV. "
    "Each input line is a verse number and its KJV text. A leading '#' marks a paragraph break; keep it. "
    'Reply with JSON only: {"verses":[{"n":<verse number>,"text":"<modernized verse>"}]} with one entry per input verse.'
    "\n\nSTYLE GUIDE\n%s"
)
REVISE_SYSTEM = (
    "You revise modernized KJV verses according to the style guide below. For each verse you get the KJV, "
    "the current modernization and reviewers' issues. Fix what the issues describe and change nothing else. "
    'Reply with JSON only: {"verses":[{"n":<verse number>,"text":"<modernized verse>"}]} for the listed verses only.'
    "\n\nSTYLE GUIDE\n%s"
)
CHECK_FOCUS = {
    "fidelity": "Check that each modernized verse keeps the full meaning of the KJV verse: nothing dropped, added or reinterpreted, and theologically weighty vocabulary kept.",
    "style": "Check each verse against the style guide: leftover archaic forms, words that should have stayed (LORD, only begotten...), and paraphrase or smoothing that the guide forbids.",
}
CHECK_SYSTEM = (
    "You review a light modernization of the King James Version. %s "
    'Reply with JSON only: {"verdict":"pass"|"fail","issues":[{"verse":<n>,"problem":"...","suggestion":"..."}]}. '
    "Report only real problems."
    "\n\nSTYLE GUIDE\n%s"
)
ARCHAIC = re.compile(r"\b(thee|thou|thy|thine|thyself|ye|hath|hast|doth|dost|didst|shalt|wilt|wast|wert|saith|unto|verily)\b", re.I)
ETH = re.compile(r"\b[a-z]{3,}eth\b")  # lowercase only, so names like Elizabeth pass
ETH_OK = {"teeth", "beneath", "nineteenth", "sixteenth", "seventeenth", "eighteenth"}  # -est verbs are left to the style checker


def style_guide():
    return (ROOT / "par" / "STYLE.md").read_text(encoding="utf-8")


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


def http(url, key, body=None, timeout=90, retries=2):
    """One request. Rate limits and server errors retry with backoff; a timeout retries once."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "User-Agent": "par-dryrun",
    })
    timeouts = 0
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
            timeouts += 1
            if timeouts < 2 and attempt < retries:
                continue
            raise RuntimeError("no response from %s after %ds: %s" % (url, timeout, e))


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


START = time.monotonic()
BUDGET = 900  # seconds for the whole run; calls after this fail fast so the run still ends


def log(msg):
    print("[%4ds] %s" % (time.monotonic() - START, msg), file=sys.stderr, flush=True)


def chat(name, prov, system, user):
    base, key, model = prov
    if time.monotonic() - START > BUDGET:
        raise RuntimeError("time budget of %ds exhausted" % BUDGET)
    step = system.split(".")[0][:40]
    t0 = time.monotonic()
    log("%s/%s: %s ..." % (name, model, step))
    res = http(base + "/chat/completions", key, {
        "model": model,
        "temperature": 0.2,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    })
    record_usage(name, res)
    log("%s: done in %.0fs" % (name, time.monotonic() - t0))
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


def load_kjv(book, chapter):
    """Return [(verse_number, kjv_text)] for one chapter of the repo's KJV (kjv/<book>.json)."""
    data = json.loads((ROOT / "kjv" / ("%s.json" % book)).read_text(encoding="utf-8"))
    if not 1 <= chapter <= len(data["chapters"]):
        raise SystemExit("%s has %d chapters" % (data["book"], len(data["chapters"])))
    return data["book"], [(i + 1, t) for i, t in enumerate(data["chapters"][chapter - 1])]


def kjv_block(verses):
    return "\n".join("%d %s" % (n, t) for n, t in verses)


def gate(src, out):
    """Deterministic checks on one chunk: same verses in order, paragraph markers kept, no archaic forms."""
    got = [int(v["n"]) for v in out["verses"]]
    if got != [n for n, _ in src]:
        raise ValueError("verse numbers %s do not match the KJV" % got)
    for (n, kjv), v in zip(src, out["verses"]):
        text = str(v["text"])
        if kjv.lstrip().startswith("#") != text.lstrip().startswith("#"):
            raise ValueError("verse %d: paragraph marker not kept" % n)
        if "[" in text or "]" in text:
            raise ValueError("verse %d: bracketed words left in" % n)
        bad = [m.group(0) for m in ARCHAIC.finditer(text)]
        bad += [w for w in ETH.findall(text) if w not in ETH_OK]
        if bad:
            raise ValueError("verse %d still has archaic forms: %s" % (n, sorted(set(bad))))
    return out["verses"]


def chunks(verses, size=CHUNK):
    return [verses[i:i + size] for i in range(0, len(verses), size)]


def draft(cfg, verses):
    """Modernize chunk by chunk; each chunk falls through the drafter chain on any failure or gate miss."""
    system = DRAFT_SYSTEM % style_guide()
    done, used = [], set()
    for part in chunks(verses):
        for name in cfg["drafters"]:
            prov = provider(cfg, name)
            if not prov:
                continue
            try:
                out = gate(part, parse_json(chat(name, prov, system, kjv_block(part))))
                done += [{"n": int(v["n"]), "kjv": dict(part)[int(v["n"])], "text": str(v["text"]).strip()} for v in out]
                used.add("%s (%s)" % (name, prov[2]))
                break
            except Exception as e:
                log("drafter %s failed on verses %d-%d: %s" % (name, part[0][0], part[-1][0], str(e)[:300]))
        else:
            log("no drafter could do verses %d-%d; keeping the finished chunks" % (part[0][0], part[-1][0]))
            done += [{"n": n, "kjv": t, "text": None} for n, t in part]
    return sorted(used), done


def check(cfg, kind, drafted):
    name = cfg["checkers"][kind]
    prov = provider(cfg, name)
    if not prov:
        return {"checker": kind, "provider": name, "verdict": "skipped", "issues": []}
    rows = [v for v in drafted if v["text"]]
    user = "\n\n".join("Verse %d\nKJV: %s\nModern: %s" % (v["n"], v["kjv"], v["text"]) for v in rows)
    try:
        out = parse_json(chat(name, prov, CHECK_SYSTEM % (CHECK_FOCUS[kind], style_guide()), user))
        return {"checker": kind, "provider": name, "model": prov[2],
                "verdict": out.get("verdict", "unknown"), "issues": out.get("issues", [])}
    except Exception as e:
        return {"checker": kind, "provider": name, "verdict": "error", "issues": [], "error": str(e)[:200]}


def revise(cfg, drafted, checks):
    """One pass: send each flagged verse back with its issues, gate the result, keep the first draft for comparison."""
    issues = {}
    for c in checks:
        for i in c["issues"]:
            try:
                issues.setdefault(int(i.get("verse")), []).append("%s: %s -> %s" % (c["checker"], i.get("problem"), i.get("suggestion")))
            except (TypeError, ValueError):
                pass
    flagged = [v for v in drafted if v["text"] and v["n"] in issues]
    if not flagged:
        return drafted, []
    user = "\n\n".join("Verse %d\nKJV: %s\nCurrent: %s\nIssues:\n- %s" % (
        v["n"], v["kjv"], v["text"], "\n- ".join(issues[v["n"]])) for v in flagged)
    system = REVISE_SYSTEM % style_guide()
    for name in cfg["drafters"]:
        prov = provider(cfg, name)
        if not prov:
            continue
        try:
            out = parse_json(chat(name, prov, system, user))
            got = gate([(v["n"], v["kjv"]) for v in flagged], out)
            new = {int(v["n"]): str(v["text"]).strip() for v in got}
            return [dict(v, text=new.get(v["n"], v["text"]), first=v["text"] if v["n"] in new else None) for v in drafted], sorted(new)
        except Exception as e:
            log("reviser %s failed: %s" % (name, str(e)[:300]))
    return drafted, []


def render(title, used, drafted, rounds, revised):
    lines = ["# %s (PAR dry run)" % title, "", "Drafters: %s" % (", ".join(used) if used else "none (all failed)"), "",
             "| v | KJV | PAR |", "|---|---|---|"]
    for v in drafted:
        t = v["text"] if v["text"] else "_not drafted_"
        if v.get("first"):
            t += " _(revised; first draft: %s)_" % v["first"]
        lines.append("| %s | %s | %s |" % (v["n"], v["kjv"], t))
    for k, checks in enumerate(rounds, 1):
        lines += ["", "## Checks, round %d%s" % (k, "" if k == 1 else " (after revising verses %s)" % ", ".join(map(str, revised))), ""]
        for c in checks:
            lines.append("- **%s** (%s): %s%s" % (c["checker"], c["provider"], c["verdict"],
                                                 " - " + c["error"] if c.get("error") else ""))
            for i in c["issues"]:
                lines.append("  - v%s: %s -> %s" % (i.get("verse"), i.get("problem"), i.get("suggestion")))
    lines += ["", "_Agreement among models is evidence, not proof. A person reviews before this is published._"]
    return "\n".join(lines) + "\n"


def main():
    global BUDGET
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-models", action="store_true")
    ap.add_argument("--book", default="psalms", help="kjv/ file stem, e.g. psalms, john, 1-john")
    ap.add_argument("--chapter", type=int, default=23)
    ap.add_argument("--out", default="par-out")
    ap.add_argument("--budget", type=int, default=BUDGET, help="seconds before remaining calls fail fast")
    ap.add_argument("--usage", default=str(HERE.parent / "usage.json"), help="token ledger to update")
    args = ap.parse_args()
    BUDGET = args.budget
    cfg = load_config()

    if args.list_models:
        list_models(cfg)
        return

    book, verses = load_kjv(args.book, args.chapter)
    used, drafted = draft(cfg, verses)
    rounds, revised = [], []
    if any(v["text"] for v in drafted):
        rounds.append([check(cfg, k, drafted) for k in cfg["checkers"]])
        if any(c["issues"] for c in rounds[0]):
            drafted, revised = revise(cfg, drafted, rounds[0])
            if revised:
                rounds.append([check(cfg, k, drafted) for k in cfg["checkers"]])
    md = render("%s %d" % (book, args.chapter), used, drafted, rounds, revised)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stem = "%s-%d" % (args.book, args.chapter)
    (out / (stem + ".md")).write_text(md, encoding="utf-8")
    # same shape as the hand-made pilot files in par/, with the run details alongside
    (out / ("pilot-%s.json" % stem)).write_text(json.dumps(
        {"book": book, "chapter": args.chapter, "verses": [v["text"] for v in drafted],
         "drafters": used, "revised": revised, "checks": rounds}, ensure_ascii=False, indent=2), encoding="utf-8")
    if USAGE:
        save_usage(args.usage)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(md)
    print(md)


if __name__ == "__main__":
    main()
