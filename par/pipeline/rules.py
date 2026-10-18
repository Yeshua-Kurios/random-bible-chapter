"""Deterministic KJV27 rules: free, instant, and run on every verse before any model reviews it.

normalize(kjv, text)       -> (text, auto_notes)   safe automatic fixes (spelling, typography, unambiguous KJV words)
check(kjv, text, note)     -> (errors, warnings)   errors fail the gate and go back to the drafter; warnings go to the reviewer

Standard library only. Nothing here calls a model.
"""
import re

# --- automatic fixes -----------------------------------------------------------------------------

# British spellings the KJV uses -> American. Applied silently.
SPELLING = {
    "honour": "honor", "favour": "favor", "neighbour": "neighbor", "saviour": "savior", "labour": "labor",
    "colour": "color", "behaviour": "behavior", "armour": "armor", "harbour": "harbor", "vapour": "vapor",
    "rumour": "rumor", "odour": "odor", "fervour": "fervor", "endeavour": "endeavor", "splendour": "splendor",
    "vigour": "vigor", "rigour": "rigor", "valour": "valor", "tumour": "tumor", "humour": "humor",
    "sceptre": "scepter", "centre": "center", "defence": "defense", "offence": "offense", "pretence": "pretense",
    "enquire": "inquire", "enquiry": "inquiry", "judgement": "judgment", "grey": "gray", "plough": "plow",
    "whilst": "while", "amongst": "among", "chesnut": "chestnut", "sulphur": "sulfur", "mould": "mold",
    "lustre": "luster", "fibre": "fiber", "theatre": "theater", "mediocre": "mediocre", "practise": "practice",
    "jewellery": "jewelry", "cheque": "check", "kerb": "curb", "tyre": "tire", "marvellous": "marvelous",
    "counsellor": "counselor", "counsellors": "counselors", "traveller": "traveler", "jeweller": "jeweler",
}
SPELLING_RE = re.compile(r"\b(%s)(ed|s|ing|able|ably)?\b" % "|".join(sorted(SPELLING, key=len, reverse=True)), re.I)

# Unambiguous KJV words with one right modern form. (pattern, replacement, note)
AUTO_WORDS = [
    (re.compile(r"\bHoly Ghost\b"), "Holy Spirit", "\"Holy Ghost\" became \"Holy Spirit\" (Greek pneuma: spirit)."),
    (re.compile(r"\bpublicans\b"), "tax collectors", "\"publicans\" became \"tax collectors\"."),
    (re.compile(r"\bpublican\b"), "tax collector", "\"publican\" became \"tax collector\"."),
    (re.compile(r"\bcandlesticks\b"), "lampstands", "\"candlesticks\" became \"lampstands\" (the lamps burned oil)."),
    (re.compile(r"\bcandlestick\b"), "lampstand", "\"candlestick\" became \"lampstand\" (the lamps burned oil)."),
    (re.compile(r"\bunicorns\b"), "wild oxen", "\"unicorns\" became \"wild oxen\" (Hebrew re'em)."),
    (re.compile(r"\bunicorn\b"), "wild ox", "\"unicorn\" became \"wild ox\" (Hebrew re'em)."),
    (re.compile(r"\bcockatrice\b"), "viper", "\"cockatrice\" became \"viper\" (a venomous snake)."),
]


def _case(src, dst):
    return dst.capitalize() if src[:1].isupper() else dst


def normalize(kjv, text):
    """Return (text, notes): typography and spelling fixed, unambiguous KJV words replaced, each replacement noted."""
    text = (text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
            .replace(" ", " "))
    text = re.sub(r"\s+", " ", text).strip()
    text = SPELLING_RE.sub(lambda m: _case(m.group(1), SPELLING[m.group(1).lower()]) + (m.group(2) or ""), text)
    notes = []
    for pat, rep, note in AUTO_WORDS:
        if pat.search(kjv) and pat.search(text):
            text = pat.sub(rep, text)
            notes.append(note)
    return text, notes


# --- hard errors: the drafter is told and fixes them ----------------------------------------------

ARCHAIC = re.compile(
    r"\b(thee|thou|thy|thine|thyself|ye|hath|hast|doth|dost|didst|shalt|wilt|wast|wert|canst|couldest|wouldest|shouldest|"
    r"saith|unto|verily|lest|wherefore|whoso|whosoever|whomsoever|yea|nay|behold|begat|brethren|spake|hearken|"
    r"peradventure|whence|whither|thence|hither|thither|howbeit|forasmuch|aforetime|alway|anon|aught|naught|betwixt|"
    r"durst|ere|fain|haply|nigh|oft|oftentimes|perchance|sith|sundry|thereof|thereon|therewith|wherein|whereof|"
    r"wherewith|withal|wist|wot|yonder|beseech|tarry|smote|bade|begotten|wherewithal|thereunto|whereunto|hereunto|lo)\b", re.I)
ETH = re.compile(r"\b[a-z]{3,}eth\b")  # lowercase only, so names like Elizabeth pass
ETH_OK = {"teeth", "beneath", "nineteenth", "sixteenth", "seventeenth", "eighteenth"}
# Verb forms like "makest", "knowest", "art" after you: only the safe, specific ones
EST = re.compile(r"\b(wouldst|shouldst|couldst|didst|hadst|knowest|seest|makest|sayest|speakest|doest|goest|comest)\b", re.I)

# KJV renderings that are wrong or misleading and have a known fix. (pattern, hint)
MUST_FIX = [
    (re.compile(r"\bEaster\b"), "\"Easter\" is wrong (Acts 12:4): the Greek is pascha, Passover"),
    (re.compile(r"\bGod forbid\b", re.I), "\"God forbid\" is not in the Greek; use \"Certainly not\" or \"By no means\""),
    (re.compile(r"\bcharity\b", re.I), "\"charity\" should be \"love\" (agape)"),
    (re.compile(r"\bdamnation\b", re.I), "\"damnation\" should be \"judgment\" or \"condemnation\""),
    (re.compile(r"\bpeculiar (people|treasure)\b", re.I), "\"peculiar\" now reads as 'odd'; use \"a people for his own possession\" or \"special treasure\""),
    (re.compile(r"\bby and by\b", re.I), "\"by and by\" meant 'immediately'; use \"immediately\""),
    (re.compile(r"\bsuffer (little children|the little children)\b", re.I), "\"suffer\" meant 'allow'; use \"let\""),
]

NUMBER_WORDS = {"two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "twenty", "thirty", "forty",
                "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "twain", "threescore", "fourscore"}
NUMBER_ALIAS = {"twain": "two", "threescore": "sixty", "fourscore": "eighty"}
DIVINE = re.compile(r"\b(LORD|GOD)\b")


def _words(s):
    return re.findall(r"[A-Za-z']+", s)


def _numbers(s):
    out = []
    for w in re.findall(r"[a-z]+", s.lower()):
        w = NUMBER_ALIAS.get(w, w)
        if w in NUMBER_WORDS:
            out.append(w)
    out += re.findall(r"\d+", s)
    return sorted(out)


def _stem(w):
    w = w.lower().strip("'")
    for suf in ("eth", "est", "ing", "ed", "es", "s"):
        if len(w) > 4 and w.endswith(suf):
            return w[:-len(suf)]
    return w


def check(kjv, text, note=None):
    """Return (errors, warnings) for one verse. `note` is the drafter's correction note, if any."""
    errors, warns = [], []
    body = kjv.lstrip("# ").strip()
    plain = re.sub(r"[\[\]]", "", body)

    # structure
    if "[" in text or "]" in text:
        errors.append("bracketed words left in")
    if kjv.lstrip().startswith("#") != text.lstrip().startswith("#"):
        errors.append("paragraph marker not kept")
    t = text.lstrip("# ").strip()
    if not t:
        return ["verse is empty"], warns
    if re.search(r"[*_`{}<>|\\]|…|�", t):
        errors.append("stray markup or odd characters")
    if t.count('"') % 2:
        errors.append("unbalanced double quotes")
    if plain.rstrip()[-1:] in ".?!:;,\"')" and t[-1:] not in ".?!:;,\"')":
        warns.append("ends without punctuation")

    # archaic English
    bad = [m.group(0) for m in ARCHAIC.finditer(t)] + [w for w in ETH.findall(t) if w not in ETH_OK] + [m.group(0) for m in EST.finditer(t)]
    if bad:
        errors.append("archaic words: %s" % ", ".join(sorted(set(w.lower() for w in bad))))
    for pat, hint in MUST_FIX:
        if pat.search(t):
            errors.append(hint)

    # content that must survive
    if sorted(DIVINE.findall(plain)) != sorted(DIVINE.findall(t)):
        errors.append("divine name changed: keep LORD and GOD exactly as in the KJV (it has: %s)" % (", ".join(DIVINE.findall(plain)) or "none"))
    kn, tn = _numbers(plain), _numbers(t)
    missing = [n for n in kn if n not in tn]
    if missing:
        errors.append("numbers dropped or changed: %s" % ", ".join(sorted(set(missing))))

    # we/us/our never change when modernizing; a swap (e.g. "for us" -> "for you") is a different manuscript reading
    first_plural = re.compile(r"\b(we|us|our|ours|ourselves)\b", re.I)
    if len(first_plural.findall(plain)) != len(first_plural.findall(t)) and not note:
        warns.append("we/us/our count differs from the KJV without a note (a different manuscript reading?)")

    # size and drift (a correction note excuses drift, but not silence)
    kw, tw = len(_words(plain)), len(_words(t))
    if kw >= 6:
        ratio = tw / kw
        if ratio < 0.45 or ratio > 2.0:
            errors.append("length changed too much (%d words -> %d): keep the verse's content, do not summarize or expand" % (kw, tw))
        elif (ratio < 0.65 or ratio > 1.6) and not note:
            warns.append("length changed noticeably (%d -> %d words) without a note" % (kw, tw))
        ks = {_stem(w) for w in _words(plain)}
        content = [w for w in _words(t) if len(w) > 3]
        if content:
            kept = sum(1 for w in content if _stem(w) in ks) / len(content)
            if kept < 0.3 and not note:
                warns.append("heavily reworded (%d%% of its words come from the KJV) without a note" % round(kept * 100))

    # names: capitalized words in the middle of the KJV verse should still be there
    names = {m.group(0) for m in re.finditer(r"\b[A-Z][a-z]{2,}\b", plain)
             if m.start() > 1 and not re.search(r"[.?!:;,\"'#]\s*$", plain[:m.start()])} - {"The", "And", "But", "For", "Then", "Thus", "God", "Lord", "Son"}
    gone = sorted(n for n in names if not re.search(r"\b%s" % re.escape(n[:4]), t))
    if gone and not note:
        warns.append("names missing without a note: %s" % ", ".join(gone))

    # words that need a reviewer's eye (sense-dependent KJV words)
    for w, hint in (("meat", "food?"), ("corn", "grain?"), ("conversation", "conduct?"), ("prevent", "precede?"), ("quick", "living?"),
                    ("bowels", "compassion/inner being?"), ("bishop", "overseer?"), ("firmament", "expanse/vault?"),
                    ("hell", "Sheol/Hades/Gehenna?"), ("shall", "will/must?")):
        if re.search(r"\b%s\b" % w, t, re.I) and not note:
            warns.append("\"%s\" kept: %s" % (w, hint))
    return errors, warns
