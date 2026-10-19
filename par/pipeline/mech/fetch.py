"""Fetch one chapter of MACULA Hebrew (syntax tree, "lowfat" form) at a pinned commit.

Run: python par/pipeline/mech/fetch.py "Jeremiah 3"      (writes par/mech-cache/<slug>.xml; the cache is not committed)

Source: https://github.com/Clear-Bible/macula-hebrew, CC BY 4.0 (see par/SOURCES.md for the required credit).
Pinned so the same chapter always renders from the same data. Change PIN on purpose, never by accident.
"""
import re
import sys
import urllib.request
from pathlib import Path

PIN = "47db250bd55d0d8577f2a94fba114ef16c35b23c"  # macula-hebrew main, checked 2026-10-19
RAW = "https://raw.githubusercontent.com/Clear-Bible/macula-hebrew/%s/WLC/lowfat/%s-%03d-lowfat.xml"
CACHE = Path(__file__).resolve().parents[2] / "mech-cache"

# app book name -> MACULA file prefix ("<number>-<abbr>")
BOOKS = {
    "Genesis": "01-Gen", "Exodus": "02-Exo", "Leviticus": "03-Lev", "Numbers": "04-Num", "Deuteronomy": "05-Deu",
    "Joshua": "06-Jos", "Judges": "07-Jdg", "Ruth": "08-Rut", "1 Samuel": "09-1Sa", "2 Samuel": "10-2Sa",
    "1 Kings": "11-1Ki", "2 Kings": "12-2Ki", "1 Chronicles": "13-1Ch", "2 Chronicles": "14-2Ch", "Ezra": "15-Ezr",
    "Nehemiah": "16-Neh", "Esther": "17-Est", "Job": "18-Job", "Psalms": "19-Psa", "Proverbs": "20-Pro",
    "Ecclesiastes": "21-Ecc", "Song of Solomon": "22-Sng", "Isaiah": "23-Isa", "Jeremiah": "24-Jer",
    "Lamentations": "25-Lam", "Ezekiel": "26-Ezk", "Daniel": "27-Dan", "Hosea": "28-HOS", "Joel": "29-Jol",
    "Amos": "30-Amo", "Obadiah": "31-Oba", "Jonah": "32-Jon", "Micah": "33-Mic", "Nahum": "34-Nam",
    "Habakkuk": "35-Hab", "Zephaniah": "36-Zep", "Haggai": "37-Hag", "Zechariah": "38-Zec", "Malachi": "39-Mal",
}


def split_ref(ref):
    m = re.match(r"^(.+) (\d+)$", ref.strip())
    if not m or m.group(1) not in BOOKS:
        raise SystemExit("not an Old Testament chapter I can fetch: %r" % ref)
    return m.group(1), int(m.group(2))


def slug(book, chapter):
    return "%s-%d" % (book.lower().replace(" ", "-"), chapter)


def fetch(ref):
    book, chapter = split_ref(ref)
    path = CACHE / (slug(book, chapter) + ".xml")
    if path.exists():
        return path
    url = RAW % (PIN, BOOKS[book], chapter)
    with urllib.request.urlopen(url, timeout=60) as r:
        data = r.read()
    if b"<chapter" not in data[:400]:
        raise SystemExit("unexpected reply for %s (%d bytes)" % (url, len(data)))
    CACHE.mkdir(exist_ok=True)
    path.write_bytes(data)
    return path


if __name__ == "__main__":
    print(fetch(" ".join(sys.argv[1:])))
