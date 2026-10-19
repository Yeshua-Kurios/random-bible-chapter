"""English inflection by fixed rules: plurals and verb forms. No model, no word lists copied from any Bible."""
import re

IRREGULAR = {  # base: (past, past participle)
    "be": ("was", "been"), "have": ("had", "had"), "do": ("did", "done"), "go": ("went", "gone"),
    "say": ("said", "said"), "see": ("saw", "seen"), "know": ("knew", "known"), "give": ("gave", "given"),
    "take": ("took", "taken"), "make": ("made", "made"), "get": ("got", "gotten"), "find": ("found", "found"),
    "stand": ("stood", "stood"), "sit": ("sat", "sat"), "lie": ("lay", "lain"), "rise": ("rose", "risen"),
    "speak": ("spoke", "spoken"), "bring": ("brought", "brought"), "build": ("built", "built"),
    "buy": ("bought", "bought"), "sell": ("sold", "sold"), "send": ("sent", "sent"), "set": ("set", "set"),
    "put": ("put", "put"), "hold": ("held", "held"), "keep": ("kept", "kept"), "leave": ("left", "left"),
    "lose": ("lost", "lost"), "meet": ("met", "met"), "pay": ("paid", "paid"), "read": ("read", "read"),
    "run": ("ran", "run"), "seek": ("sought", "sought"), "shake": ("shook", "shaken"), "shed": ("shed", "shed"),
    "shine": ("shone", "shone"), "show": ("showed", "shown"), "shut": ("shut", "shut"), "sing": ("sang", "sung"),
    "sink": ("sank", "sunk"), "sleep": ("slept", "slept"), "slay": ("slew", "slain"), "strike": ("struck", "struck"),
    "sow": ("sowed", "sown"), "spend": ("spent", "spent"), "spread": ("spread", "spread"), "steal": ("stole", "stolen"),
    "swear": ("swore", "sworn"), "sweep": ("swept", "swept"), "swell": ("swelled", "swollen"), "teach": ("taught", "taught"),
    "tear": ("tore", "torn"), "tell": ("told", "told"), "think": ("thought", "thought"), "throw": ("threw", "thrown"),
    "tread": ("trod", "trodden"), "understand": ("understood", "understood"), "wake": ("woke", "woken"),
    "wear": ("wore", "worn"), "weep": ("wept", "wept"), "win": ("won", "won"), "wind": ("wound", "wound"),
    "write": ("wrote", "written"), "bear": ("bore", "borne"), "beat": ("beat", "beaten"), "become": ("became", "become"),
    "begin": ("began", "begun"), "bind": ("bound", "bound"), "bite": ("bit", "bitten"), "bleed": ("bled", "bled"),
    "blow": ("blew", "blown"), "break": ("broke", "broken"), "breed": ("bred", "bred"), "burst": ("burst", "burst"),
    "cast": ("cast", "cast"), "catch": ("caught", "caught"), "choose": ("chose", "chosen"), "cling": ("clung", "clung"),
    "come": ("came", "come"), "cut": ("cut", "cut"), "deal": ("dealt", "dealt"), "dig": ("dug", "dug"),
    "draw": ("drew", "drawn"), "drink": ("drank", "drunk"), "drive": ("drove", "driven"), "dwell": ("dwelt", "dwelt"),
    "eat": ("ate", "eaten"), "fall": ("fell", "fallen"), "feed": ("fed", "fed"), "feel": ("felt", "felt"),
    "fight": ("fought", "fought"), "flee": ("fled", "fled"), "fly": ("flew", "flown"), "forbid": ("forbade", "forbidden"),
    "forget": ("forgot", "forgotten"), "forgive": ("forgave", "forgiven"), "freeze": ("froze", "frozen"),
    "grind": ("ground", "ground"), "grow": ("grew", "grown"), "hang": ("hung", "hung"), "hear": ("heard", "heard"),
    "hide": ("hid", "hidden"), "hit": ("hit", "hit"), "hurt": ("hurt", "hurt"), "kneel": ("knelt", "knelt"),
    "lay": ("laid", "laid"), "lead": ("led", "led"), "lend": ("lent", "lent"), "let": ("let", "let"),
    "light": ("lit", "lit"), "mean": ("meant", "meant"), "overcome": ("overcame", "overcome"), "rend": ("rent", "rent"),
    "ride": ("rode", "ridden"), "ring": ("rang", "rung"), "split": ("split", "split"), "spring": ("sprang", "sprung"),
    "stick": ("stuck", "stuck"), "sting": ("stung", "stung"), "swing": ("swung", "swung"), "thrust": ("thrust", "thrust"),
    "withdraw": ("withdrew", "withdrawn"), "withhold": ("withheld", "withheld"), "wring": ("wrung", "wrung"),
    "arise": ("arose", "arisen"), "awake": ("awoke", "awoken"), "beget": ("fathered", "fathered"), "behold": ("beheld", "beheld"),
    "bid": ("bade", "bidden"), "flow": ("flowed", "flowed"), "go up": ("went up", "gone up"), "lift": ("lifted", "lifted"),
    "leap": ("leapt", "leapt"), "learn": ("learned", "learned"), "lean": ("leaned", "leaned"), "spill": ("spilled", "spilled"),
    "slide": ("slid", "slid"), "smite": ("struck", "struck"), "strive": ("strove", "striven"), "uphold": ("upheld", "upheld"),
    "undo": ("undid", "undone"), "mislead": ("misled", "misled"), "outdo": ("outdid", "outdone"),
}
DOUBLE = set("stop plan beg rob trap strip drop ship slip grab nod pat clap drag flap hop jog knit pad rub scan skip slam "
             "sob spot step stir strap sum tap trim tug wrap whip admit commit permit omit refer prefer occur".split())
DOUBLE |= {"sin", "ban", "fan"}
PLURAL_IRR = {"man": "men", "woman": "women", "child": "children", "foot": "feet", "tooth": "teeth", "ox": "oxen",
              "sheep": "sheep", "people": "people", "mouse": "mice", "wife": "wives", "life": "lives", "knife": "knives",
              "calf": "calves", "half": "halves", "leaf": "leaves", "wolf": "wolves", "thief": "thieves", "self": "selves",
              "shelf": "shelves", "loaf": "loaves", "fish": "fish", "deer": "deer", "goat": "goats"}
AUX_BE = {("first", "singular"): "was", ("third", "singular"): "was"}


def pluralize(w):
    """Plural of a (possibly multi-word) noun; only the last word changes unless the phrase is 'X of Y'."""
    parts = w.split(" ")
    if "of" in parts:
        i = parts.index("of")
        parts[i - 1] = pluralize(parts[i - 1])
        return " ".join(parts)
    h = parts[-1]
    low = h.lower()
    if low in PLURAL_IRR:
        new = PLURAL_IRR[low]
    elif re.search(r"(s|x|z|ch|sh)$", low):
        new = h + "es"
    elif re.search(r"[^aeiou]y$", low):
        new = h[:-1] + "ies"
    else:
        new = h + "s"
    parts[-1] = new[:1].upper() + new[1:] if h[:1].isupper() and h != low else new
    return " ".join(parts)


def _regular(base, suffix):
    if suffix == "ed":
        if base.endswith("e"):
            return base + "d"
        if re.search(r"[^aeiou]y$", base):
            return base[:-1] + "ied"
        if base in DOUBLE:
            return base + base[-1] + "ed"
        return base + "ed"
    if suffix == "ing":
        if base.endswith("ie"):
            return base[:-2] + "ying"
        if base.endswith("e") and not base.endswith("ee"):
            return base[:-1] + "ing"
        if base in DOUBLE:
            return base + base[-1] + "ing"
        return base + "ing"


def split_head(phrase):
    """'go up' -> ('go', ' up'). Only the first word of a verb gloss inflects."""
    head, _, rest = phrase.partition(" ")
    return head, (" " + rest if rest else "")


def past(base, person=None, number=None):
    head, rest = split_head(base)
    if head == "be":
        return be_past(person, number) + rest
    if base in IRREGULAR:
        return IRREGULAR[base][0]
    head, rest = split_head(base)
    if head in IRREGULAR:
        return IRREGULAR[head][0] + rest
    return _regular(head, "ed") + rest


def participle(base):
    if base in IRREGULAR:
        return IRREGULAR[base][1]
    head, rest = split_head(base)
    if head in IRREGULAR:
        return IRREGULAR[head][1] + rest
    return _regular(head, "ed") + rest


def gerund(base):
    head, rest = split_head(base)
    if head == "be":
        return "being" + rest
    return _regular(head, "ing") + rest


def be_past(person, number):
    if person == "second" or number == "plural" or (person == "first" and number == "plural"):
        return "were"
    return "was"
