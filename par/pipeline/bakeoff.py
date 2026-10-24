#!/usr/bin/env python3
"""KJV27 model bake-off: draft one short chapter + study notes through several providers directly
(not via the production par-daily pipeline, and not via claude-code-action), for an apples-to-apples
quality/cost comparison. Never touches par/text, par/review, par/notes, par/progress.json, or
par/queue.json -- everything is written under par/bakeoff-out/. Standard library only.

  python par/pipeline/bakeoff.py --book 3-john --chapter 1

Providers run only if their key env var is set, so this is safe to run with any subset of
ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import dryrun  # reuse load_kjv, kjv_block, gate, style_guide, parse_json, http (par/pipeline/dryrun.py)

ROOT = HERE.parent.parent
OUT = ROOT / "par" / "bakeoff-out"

# $ per million tokens (input, output), as researched and cross-checked against each provider's own
# pricing page on 2026-10-24. Anthropic here is the direct API key, NOT the claude_code_oauth_token
# the production job uses, so this cost is a genuine, comparable dollar figure across all four.
PRICES = {
    "anthropic": (2.00, 10.00),   # Claude Sonnet 5.5, platform.claude.com/docs/en/about-claude/pricing
    "openai": (1.25, 10.00),      # GPT-5.1; third-party-sourced, could not reach openai.com directly (403)
    "gemini": (2.00, 12.00),      # Gemini 3.1 Pro <=200k tokens, ai.google.dev/gemini-api/docs/pricing
    "deepseek": (0.66, 1.98),     # DeepSeek V4 Pro, peak rate, api-docs.deepseek.com/quick_start/pricing
}

OPENAI_COMPAT = {
    "openai": {"base_url": "https://api.openai.com/v1", "key_env": "OPENAI_API_KEY", "model": "gpt-5.1"},
    "gemini": {"base_url": "https://generativelanguage.googleapis.com/v1beta/openai", "key_env": "GEMINI_API_KEY", "model": "gemini-3.1-pro-preview"},
    "deepseek": {"base_url": "https://api.deepseek.com", "key_env": "DEEPSEEK_API_KEY", "model": "deepseek-v4-pro"},
}
ANTHROPIC_MODEL = "claude-sonnet-5-5"

NOTES_SYSTEM = (
    "You add study notes (the reader's tap-for-more popups) to an already-modernized KJV chapter. "
    "Write 2 to 5 notes, only where you are genuinely confident; fewer or none is fine. "
    "Each note: under 700 characters, names a real source, hedges anything scholars dispute. "
    'Reply with JSON only: {"notes":[{"v":<verse>,"match":["<KJV27 phrase>","<KJV phrase>"],'
    '"kind":"word|variant|ane|archaeology|extrabiblical|prophecy|canon","title":"...","text":"...",'
    '"refs":["..."],"source":"..."}]}. '
    "Never invent a source, inscription number, or quotation; omit a note rather than guess one. "
    "\"prophecy\" notes only for what independent historical records back up."
)


def anthropic_chat(key, model, system, user):
    body = {
        "model": model,
        "max_tokens": 4096,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(body).encode(),
        headers={
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "User-Agent": "par-bakeoff",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.load(r)
    text = "".join(b.get("text", "") for b in res.get("content", []) if b.get("type") == "text")
    usage = res.get("usage") or {}
    tokens = {
        "prompt_tokens": int(usage.get("input_tokens") or 0),
        "completion_tokens": int(usage.get("output_tokens") or 0),
    }
    return text, tokens


def openai_compat_chat(base_url, key, model, system, user):
    res = dryrun.http(base_url.rstrip("/") + "/chat/completions", key, {
        "model": model,
        "temperature": 0.2,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    })
    text = res["choices"][0]["message"]["content"]
    u = res.get("usage") or {}
    tokens = {"prompt_tokens": int(u.get("prompt_tokens") or 0), "completion_tokens": int(u.get("completion_tokens") or 0)}
    return text, tokens


def call(name, system, user):
    """Return (text, tokens) for one provider, or raise if its key is unset or the call fails."""
    if name == "anthropic":
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        return anthropic_chat(key, ANTHROPIC_MODEL, system, user)
    cfg = OPENAI_COMPAT[name]
    key = os.environ.get(cfg["key_env"])
    if not key:
        raise RuntimeError("%s not set" % cfg["key_env"])
    return openai_compat_chat(cfg["base_url"], key, cfg["model"], system, user)


def cost(name, tokens):
    pin, pout = PRICES[name]
    return tokens["prompt_tokens"] / 1e6 * pin + tokens["completion_tokens"] / 1e6 * pout


def run_one(name, book, chapter_n, verses, kjv_text):
    result = {"provider": name, "ok": False}
    totals = {"prompt_tokens": 0, "completion_tokens": 0}
    t0 = time.monotonic()
    try:
        draft_system = dryrun.DRAFT_SYSTEM % dryrun.style_guide()
        text, tok = call(name, draft_system, dryrun.kjv_block(verses))
        for k in totals:
            totals[k] += tok[k]
        parsed = dryrun.parse_json(text)
        gated = dryrun.gate(verses, parsed)
        result["draft"] = gated
        result["gate"] = "pass"
    except Exception as e:
        result["gate"] = "fail"
        result["gate_error"] = str(e)[:500]
        result["draft"] = None

    notes = []
    if result["draft"]:
        try:
            chapter_block = "\n".join("%d %s" % (v["n"], v["text"]) for v in result["draft"])
            user = "KJV27 text:\n%s\n\nKJV text, for reference:\n%s" % (chapter_block, kjv_text)
            text, tok = call(name, NOTES_SYSTEM, user)
            for k in totals:
                totals[k] += tok[k]
            parsed = dryrun.parse_json(text)
            notes = parsed.get("notes", [])
        except Exception as e:
            result["notes_error"] = str(e)[:500]

    result["notes"] = notes
    result["notes_check"] = check_notes(notes, result["draft"], kjv_text)
    result["tokens"] = totals
    result["cost_usd"] = round(cost(name, totals), 4) if name in PRICES else None
    result["seconds"] = round(time.monotonic() - t0, 1)
    result["ok"] = result["gate"] == "pass"
    return result


def check_notes(notes, draft, kjv_text):
    """Lightweight standalone check (mirrors par/pipeline/notes_check.py's rules) without touching
    the production par/notes/ files or index."""
    problems = []
    kinds = {"word", "variant", "ane", "archaeology", "extrabiblical", "prophecy", "canon"}
    kjv27_text = " ".join(v["text"] for v in draft) if draft else ""
    if not 0 <= len(notes) <= 8:
        problems.append("unusual note count: %d" % len(notes))
    for i, n in enumerate(notes):
        if n.get("kind") not in kinds:
            problems.append("note %d: bad kind %r" % (i, n.get("kind")))
        if len(n.get("text", "")) > 700:
            problems.append("note %d: text over 700 chars (%d)" % (i, len(n.get("text", ""))))
        if not n.get("source"):
            problems.append("note %d: no source named" % i)
        match = n.get("match") or []
        if not match or not any(m and (m in kjv27_text or m in kjv_text) for m in match):
            problems.append("note %d: no match phrase found in either text" % i)
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", default="3-john")
    ap.add_argument("--chapter", type=int, default=1)
    ap.add_argument("--providers", default="anthropic,openai,gemini,deepseek",
                     help="comma-separated subset of anthropic,openai,gemini,deepseek")
    args = ap.parse_args()
    providers = [p.strip() for p in args.providers.split(",") if p.strip()]

    title, verses = dryrun.load_kjv(args.book, args.chapter)
    kjv_text = dryrun.kjv_block(verses)
    OUT.mkdir(parents=True, exist_ok=True)

    results = []
    for name in providers:
        print("running %s ..." % name, file=sys.stderr)
        res = run_one(name, title, args.chapter, verses, kjv_text)
        results.append(res)
        d = OUT / name
        d.mkdir(parents=True, exist_ok=True)
        (d / "result.json").write_text(json.dumps(res, indent=2), encoding="utf-8")
        print("%s: gate=%s notes=%d cost=$%s (%ss)" % (
            name, res["gate"], len(res.get("notes") or []), res.get("cost_usd"), res["seconds"]), file=sys.stderr)

    report = ["# KJV27 model bake-off: %s %d" % (title, args.chapter), "",
              "| provider | gate | notes | notes problems | tokens (in/out) | cost (est., metered) | time |",
              "|---|---|---|---|---|---|---|"]
    for r in results:
        tok = r.get("tokens") or {}
        report.append("| %s | %s | %d | %d | %d/%d | $%s | %ss |" % (
            r["provider"], r["gate"], len(r.get("notes") or []), len(r.get("notes_check") or []),
            tok.get("prompt_tokens", 0), tok.get("completion_tokens", 0), r.get("cost_usd"), r["seconds"]))
    report.append("")
    report.append("Gate failures and notes problems are logged in each provider's result.json. "
                   "This is NOT a quality score -- read each provider's draft and review table by hand, "
                   "blind if possible, before deciding anything.")
    (OUT / "REPORT.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))


if __name__ == "__main__":
    main()
