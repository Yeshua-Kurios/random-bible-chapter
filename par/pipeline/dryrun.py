#!/usr/bin/env python3
"""Dry run: translate one chapter from the Hebrew with a free model, then cross-check it.

Usage: dryrun.py --osis Ps --chapter 23 --kjv-file psalms --out par/dryrun

Standard library only. API keys are read from environment variables named in config.json
and are never printed.
"""
import argparse, json, os, re, sys, time, urllib.request, urllib.error
import xml.etree.ElementTree as ET

OSIS = "{http://www.bibletechnologies.net/2003/OSIS/namespace}"
SRC = "https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/{osis}.xml"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


def hebrew_chapter(osis, chapter):
    with urllib.request.urlopen(SRC.format(osis=osis), timeout=60) as r:
        tree = ET.parse(r)
    for ch in tree.iter(OSIS + "chapter"):
        if ch.get("osisID") == f"{osis}.{chapter}":
            return [
                " ".join((w.text or "").replace("/", "") for w in v.iter(OSIS + "w"))
                for v in ch.iter(OSIS + "verse")
            ]
    sys.exit(f"chapter {osis}.{chapter} not found")


def call(cfg, system, user):
    key = os.environ.get(cfg["key_env"])
    if not key:
        return None, f"skipped: {cfg['key_env']} not set"
    body = json.dumps({
        "model": cfg["model"],
        "temperature": 0.2,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request(
        cfg["base_url"].rstrip("/") + "/chat/completions", data=body,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)["choices"][0]["message"]["content"], None
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 ** (attempt + 2))
                continue
            return None, f"HTTP {e.code} from {cfg['base_url']} ({cfg['model']})"
        except Exception as e:
            return None, f"{type(e).__name__} from {cfg['base_url']}"
    return None, "retries exhausted"


def parse_json(text):
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osis", required=True)
    ap.add_argument("--chapter", type=int, required=True)
    ap.add_argument("--kjv-file", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    cfg = json.load(open(os.path.join(HERE, "config.json")))
    style = open(os.path.join(ROOT, "par", "STYLE.md")).read()
    heb = hebrew_chapter(a.osis, a.chapter)
    kjv = json.load(open(os.path.join(ROOT, "kjv", a.kjv_file + ".json")))["chapters"][a.chapter - 1]
    report = {"hebrew": heb, "kjv": kjv, "errors": []}

    draft_sys = ("You translate biblical Hebrew into modern English, following this style guide:\n"
                 + style +
                 "\nTranslate from the Hebrew given, not from memory of any English Bible. "
                 "Return only JSON: {\"verses\":[{\"n\":1,\"gloss\":\"word-by-word gloss\","
                 "\"translation\":\"...\"}]} with exactly one entry per verse.")
    user = "\n".join(f"{i}. {v}" for i, v in enumerate(heb, 1))
    text, err = call(cfg["drafter"], draft_sys, user)
    if err:
        report["errors"].append(f"drafter: {err}")
    draft = parse_json(text) if text else None
    verses = (draft or {}).get("verses", [])
    report["draft"] = verses
    report["gate"] = {"hebrew_verses": len(heb), "draft_verses": len(verses),
                      "count_matches": len(heb) == len(verses)}

    report["checks"] = []
    if verses:
        payload = json.dumps({"hebrew": heb, "kjv": kjv, "draft": [v.get("translation") for v in verses]},
                             ensure_ascii=False)
        for c in cfg["checkers"]:
            sys_p = (f"You are the '{c['name']}' reviewer of a Hebrew-to-English draft. {c['role']}\n"
                     "PAR style guide:\n" + style +
                     "\nReturn only JSON: {\"verdict\":\"pass|fail\",\"issues\":"
                     "[{\"verse\":1,\"problem\":\"...\",\"suggestion\":\"...\"}]}. "
                     "Report real problems only; an empty issues list is fine.")
            t, e = call(c, sys_p, payload)
            report["checks"].append({"checker": c["name"], "model": c["model"], "error": e,
                                     "result": parse_json(t) if t else None})
            if e:
                report["errors"].append(f"{c['name']}: {e}")

    os.makedirs(a.out, exist_ok=True)
    base = os.path.join(a.out, f"{a.osis}-{a.chapter}")
    json.dump(report, open(base + ".json", "w"), ensure_ascii=False, indent=1)

    lines = [f"# Dry run: {a.osis} {a.chapter}", "",
             f"Gate: {report['gate']}", ""]
    if report["errors"]:
        lines += ["## Errors", *[f"- {e}" for e in report["errors"]], ""]
    lines += ["## Verses", "| v | Hebrew | Draft | KJV |", "|---|---|---|---|"]
    for i, h in enumerate(heb):
        d = verses[i]["translation"] if i < len(verses) else ""
        lines.append(f"| {i+1} | {h} | {d} | {kjv[i] if i < len(kjv) else ''} |")
    for c in report["checks"]:
        lines += ["", f"## Checker: {c['checker']} ({c['model']})"]
        r = c["result"]
        if not r:
            lines.append(f"- no result ({c['error'] or 'unparseable output'})")
            continue
        lines.append(f"- verdict: {r.get('verdict')}")
        for it in r.get("issues", []):
            lines.append(f"- v{it.get('verse')}: {it.get('problem')} -> {it.get('suggestion')}")
    md = "\n".join(lines) + "\n"
    open(base + ".md", "w").write(md)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        open(summary, "a").write(md)
    print(md)


if __name__ == "__main__":
    main()
