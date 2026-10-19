"""Vocabulary for the mechanical stage: STEPBible TBESH (Tyndale Brief lexicon of Extended Strongs, Hebrew).

Only the `Gloss` column is used. It was written by Tyndale scholars and is CC BY 4.0. The `Meaning` column is
Online Bible's abridged BDB and its header says permission is needed, so it is never read or copied.
STEPBible asks that the data not be redistributed, so it is fetched at a pinned commit into par/mech-cache/
(git-ignored) and never committed. Credit: "STEP Bible", www.STEPBible.org.

`glossary.json` (committed) holds this project's own fixed decisions and wins over the lexicon.
"""
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

PIN = "ed476a8ee6e3f7b3a46fc48af6c7dabc02387b1d"  # STEPBible-Data master, checked 2026-10-19
NAME = "TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt"
URL = "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/%s/Lexicons/%s" % (PIN, urllib.parse.quote(NAME))
HERE = Path(__file__).resolve().parent
CACHE = HERE.parents[1] / "mech-cache"
MODERN = {"behold": "look", "lo": "look", "wherefore": "why", "yea": "indeed", "peradventure": "perhaps",
          "whither": "where", "whence": "from where", "verily": "truly", "thee": "you", "thou": "you", "thy": "your"}

_lex = None
PROPER = re.compile(r":N-[A-Z]*-[PLTG]")


def load():
    """eStrong key -> list of (morph, gloss) in file order. Only the Gloss column is kept."""
    global _lex
    if _lex is not None:
        return _lex
    path = CACHE / "tbesh.txt"
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        with urllib.request.urlopen(URL, timeout=120) as r:
            path.write_bytes(r.read())
    lex = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        p = line.split("\t")
        if len(p) >= 7 and re.match(r"^H\d{4}[a-z]?$", p[0]):
            lex.setdefault(p[0], []).append((p[5], p[6]))
    _lex = lex
    return lex


def glossary():
    return json.loads((HERE / "glossary.json").read_text(encoding="utf8"))


def fits(morph, pos, proper):
    if pos == "verb":
        return ":V" in morph
    if pos in ("noun", "adjective"):
        name = bool(PROPER.search(morph))
        return ":N" in morph and name == proper or (pos == "adjective" and ":A" in morph and not proper)
    return True


def raw_gloss(strong, pos=None, proper=False):
    """Gloss for a MACULA `strongnumberx` value such as '0559', '0871a' or '3641b'; None if the lexicon lacks it.
    When one Strong number holds several entries (a verb and a name, say), the entry matching the word's part of
    speech wins; otherwise the first entry of the exact number does."""
    if not strong:
        return None
    base = "H" + strong[:4]
    g = glossary()["words"]
    if base in g:
        return g[base]
    L = load()
    keys = ["H" + strong] + [base + c for c in ("", "a", "b", "c", "d", "e")]
    rows = []
    for key in dict.fromkeys(keys):
        rows += L.get(key, [])
    for morph, gloss in rows:           # a common word's gloss starts lowercase; a name's starts uppercase
        if fits(morph, pos, proper) and (pos not in ("noun", "adjective", "verb") or gloss[:1].isupper() == proper):
            return gloss
    for morph, gloss in rows:
        if fits(morph, pos, proper):
            return gloss
    return rows[0][1] if rows else None


def clean(gloss, verb=False):
    """'to return: return' -> 'return'; 'in/on/with' -> 'in'; '[the]' -> 'the'; '(Huram)-abi' -> 'Huram-abi'."""
    s = gloss.split(":")[0].strip()
    s = re.split(r"\s*/\s*|\s*,\s*", s)[0].strip()
    s = re.sub(r"^\[(.*)\]$", r"\1", s).replace("(", "").replace(")", "")
    if verb:
        s = re.sub(r"^to ", "", s)
    s = " ".join(MODERN.get(w.lower(), w) for w in s.split())
    return s
