"""Mechanical stage: MACULA Hebrew syntax tree -> literal English draft, with no model and no existing English Bible.

Run: python par/pipeline/mech/render.py "Jeremiah 3"      (writes par/mech/<slug>.json and prints the draft)

Everything is a fixed rule, so the same input always gives the same output:
  - vocabulary: STEPBible TBESH Gloss column (lex.py) plus this project's glossary.json; never an English Bible
  - grammar: tense, person, number and stem come from the word's own tags (OSHB morphology in MACULA)
  - order: each clause is put in English order using the tree's roles (subject, verb, object ...)
  - adjectives, demonstratives and possessive endings move in front of their noun; the object marker is silent;
    a subject pronoun is added when only the verb ending carries it; a verbless clause gets is/are
  - every source word is accounted for, so the gate can prove nothing was dropped
What it does not do: choose natural idiom, decide mood from context, or punctuate poetry. That is the smoothing
stage, which receives the hints recorded here (verb type, stem, person) and must keep every word aligned.
"""
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import english  # noqa: E402
import fetch  # noqa: E402
import lex  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "mech"
XMLID = "{http://www.w3.org/XML/1998/namespace}id"
POSS = {"my", "your", "his", "her", "its", "our", "their"}
DEMO = {"this", "that", "these", "those"}
PREFIX = {"ב": "in", "ל": "to", "כ": "like", "ו": "and", "ה": "the", "ש": "that", "מ": "from", "מן": "from"}
SUBJ = {("first", "singular"): "I", ("first", "plural"): "we", ("second", "singular"): "you", ("second", "plural"): "you",
        ("third", "plural"): "they"}
OBJ = {"I": "me", "we": "us", "you": "you", "he": "him", "she": "her", "they": "them"}
POSSV = {"I": "my", "we": "our", "you": "your", "he": "his", "she": "her", "they": "their"}
REFL = {"I": "myself", "we": "ourselves", "you": "yourself", "he": "himself", "she": "herself", "they": "themselves"}
NO_OF = {"declares"}                      # 'declares the LORD' is a fixed formula, not 'declaration of'
SINGULAR_FORMS = {"0430"}                 # elohim is plural in form; "God" unless a person rules otherwise
FINITE = {"qatal", "wayyiqtol", "yiqtol", "weqatal", "imperative", "jussive", "cohortative"}


class T:
    """One output token: text, the source word ids it stands for, its verse, and whether it is punctuation."""
    __slots__ = ("t", "ids", "v", "p")

    def __init__(self, t, ids=(), v=0, p=False):
        self.t, self.ids, self.v, self.p = t, tuple(ids), v, p


class Ctx:
    def __init__(self):
        self.seen, self.hints, self.flags, self.unknown, self.nogloss = [], {}, {}, set(), []
        self.keep = {}       # verse -> proper names and numbers the smoothed text must still contain

    def hint(self, v, s):
        self.hints.setdefault(v, []).append(s)

    def flag(self, v, s):
        if s not in self.flags.setdefault(v, []):
            self.flags[v].append(s)


def verse_of(w):
    m = re.search(r":(\d+)!", w.get("ref") or "")
    return int(m.group(1)) if m else 0


def pgn_pronoun(w):
    """he/she/I/you/we/they from the word's person, gender and number tags; None if it has none."""
    person, number, gender = w.get("person"), w.get("number"), w.get("gender")
    if not person:
        return None
    if (person, number) in SUBJ:
        return SUBJ[(person, number)]
    return "she" if gender == "feminine" else "he"


def bare(s):
    """A Hebrew word without vowel points or accents."""
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if not unicodedata.combining(c))


def lexical(w, cx, verb=False):
    g = lex.raw_gloss(w.get("strongnumberx"), w.get("pos"), (w.get("type") or "") in ("proper", "gentilic"))
    if g is None:
        cx.nogloss.append((w.get(XMLID), w.get("lemma")))
        return "[%s]" % (w.get("transliteration") or w.get("lemma") or "?")
    return lex.clean(g, verb=verb) or "[%s]" % (w.get("transliteration") or "?")


def base_word(w, cx, mode=None):
    """English for one non-verb word. '' means the word is silent in English."""
    cls, typ = w.get("class"), w.get("type") or ""
    if cls == "art":
        return "the"
    if cls == "om":
        return ""
    if cls in ("prep", "cj", "art", "rel", "ptcl") and bare(w.get("lemma")) in PREFIX and len(bare(w.get("text") or w.text)) <= 3:
        return PREFIX[bare(w.get("lemma"))]
    if cls == "pron" and typ == "pronominal":                     # pronoun ending on a noun, preposition or verb
        who = pgn_pronoun(w) or "it"
        if mode == "poss":
            return POSSV.get(who, "its" if who == "it" else who)
        return OBJ.get(who, who)
    if cls == "pron" and typ == "personal":
        return pgn_pronoun(w) or "it"
    if cls == "x" and "directional" in typ:
        return "toward"
    if "paragogic" in typ:
        return ""
    if cls == "ptcl" and typ == "interrogative":
        return "?"
    if cls == "noun":
        g = lexical(w, cx)
        if typ != "proper" and w.get("number") in ("plural", "dual") and (w.get("strongnumberx") or "")[:4] not in SINGULAR_FORMS:
            g = english.pluralize(g)
        return g
    if cls == "cj" and lex.raw_gloss(w.get("strongnumberx")) in ("&", None):
        return "and"
    if cls == "verb":
        return verb_simple(w, cx)
    return lexical(w, cx)


def verb_simple(w, cx):
    return verb_form(lexical(w, cx, verb=True), w, False)[0]


def verb_form(base, w, neg):
    """(text, note) for a verb from its type, stem and person; neg=True builds the negative form."""
    typ, stem = w.get("type") or "", w.get("stem") or ""
    who = pgn_pronoun(w) or "he"
    passive = stem in ("niphal", "pual", "hophal")
    was = english.be_past(w.get("person"), w.get("number"))
    passive = passive and not base.startswith("be ")       # 'be ashamed' is already a state, not an action
    ppl = english.participle(base)
    refl = REFL.get(who, "themselves") if stem in ("hithpael", "hithpolel") else ""

    def tail(s):
        return (s + " " + refl).strip() if refl else s

    if typ.startswith("infinitive absolute"):
        return ("not " if neg else "") + tail(base), "infinitive absolute"
    if typ.startswith("infinitive"):
        return ("not to " if neg else "to ") + ("be " + ppl if passive else tail(base)), typ
    if typ == "participle active":
        return ("not " if neg else "") + english.gerund(base if not passive else "be " + ppl), typ
    if typ == "participle passive":
        return ("not " if neg else "") + ppl, typ
    if typ in ("qatal", "wayyiqtol"):
        if passive:
            return was + (" not " if neg else " ") + ppl, typ
        if base.split(" ")[0] == "be":
            return english.past(base, w.get("person"), w.get("number")).replace(was, was + " not", 1) if neg else \
                tail(english.past(base, w.get("person"), w.get("number"))), typ
        return ("did not " + tail(base)) if neg else tail(english.past(base)), typ
    if typ in ("yiqtol", "weqatal"):
        mid = "be " + ppl if passive else tail(base)
        return "will " + ("not " if neg else "") + mid, typ
    if typ == "imperative":
        mid = "be " + ppl if passive else tail(base)
        return ("do not " if neg else "") + mid, typ
    if typ in ("jussive", "cohortative"):
        mid = "be " + ppl if passive else tail(base)
        return "let " + OBJ.get(who, who) + (" not " if neg else " ") + mid, typ
    return tail(base), typ or "?"


def leaf(w, cx, mode=None):
    cx.seen.append(w.get(XMLID))
    text = base_word(w, cx, mode)
    if text and (w.get("class") == "num" or (w.get("class") == "noun" and w.get("type") in ("proper", "gentilic"))):
        cx.keep.setdefault(verse_of(w), []).append(text)
    return [T(text, [cx.seen[-1]], verse_of(w))] if text else []


def role_of(n):
    return n.get("role") or ""


def realize(n, cx, mode=None):
    if n.tag == "w":
        return leaf(n, cx, mode)
    rule, cls = n.get("rule") or "", n.get("class") or ""
    if cls == "cl":
        return clause(n, cx)
    return phrase(n, rule, cx)


def strip_the(toks):
    return toks[1:] if toks and toks[0].t == "the" else toks


KNOWN_RULES = {
    "DetNP", "PrepNp", "PpPp", "PPandPP", "PrepCL", "QuanNP", "NpPp", "NpaNp", "Conj3Np", "NumpNP", "DetAdjp",
    "NpRelp", "relCL", "CL2NP", "NpCL", "NounX", "PpAdvp", "CL2Adjp", "P2CL", "Np2CL", "PP2CL", "Intj2CL", "PtclCL",
    "ClCl", "ClCl2", "CLaCL", "cjpCLx", "NpAdjp", "NPofNP", "2Np", "CjpCjp", "PpNp2Np", "Relp2Np", "VPandVP", "VerbX",
    "cjpNp", "OmpNP", "NPDet", "NpNump", "Np-Appos",
}
MERGE_PREPS = {("from", "with"): "from", ("from", "upon"): "from", ("from", "to"): "from"}


def phrase(n, rule, cx):
    kids = list(n)
    if rule == "DetAdjp" and len(kids) == 2 and kids[1].tag == "w" and kids[1].get("class") == "pron":
        for k in kids:
            cx.seen.append(k.get(XMLID))
        plural = kids[1].get("number") == "plural"
        return [T("those" if plural else "that", [k.get(XMLID) for k in kids], verse_of(kids[1]))]
    outs = []
    for i, k in enumerate(kids):
        mode = "poss" if (rule == "NPofNP" and i == len(kids) - 1 and k.tag == "w") else None
        outs.append(realize(k, cx, mode))
    if rule == "NPofNP" and len(kids) >= 2:
        lt, head = outs[-1], [t for o in outs[:-1] for t in o]
        if kids[-1].tag == "w" and len(lt) == 1 and lt[0].t.lower() in POSS:
            return lt + strip_the(head)
        if not lt or not head:
            return head or lt
        if head[-1].t in NO_OF:
            return head + lt
        return head + [T("of")] + lt
    if rule.startswith("Np") and "Adjp" in rule and len(kids) == 2:
        noun, adj = outs
        if adj and adj[0].t == "the":
            adj = adj[1:]
        return adj + noun
    if rule == "NPDet" and len(kids) == 2:
        return strip_the(outs[1]) + outs[0]
    if rule == "NpNump" and len(kids) == 2:
        return outs[1] + outs[0]
    if rule == "Np-Appos" and len(kids) == 2:
        second_the = outs[1] and outs[1][0].t == "the"
        return outs[0] + ([T(",", p=True)] if second_the else []) + outs[1]
    if rule in ("PpPp",) and len(outs) == 2 and outs[0] and outs[1]:
        pair = (outs[0][-1].t, outs[1][0].t)
        if pair in MERGE_PREPS:
            return [T(MERGE_PREPS[pair], outs[0][-1].ids + outs[1][0].ids, outs[0][-1].v)] + outs[1][1:]
    if rule and rule not in KNOWN_RULES:
        cx.unknown.add(rule)
    return [t for o in outs for t in o]


def kind(ch):
    if ch.tag == "w":
        r = role_of(ch)
        if r:
            if r == "adv" and ch.get("class") == "adv" and ch.get("type") == "negative":
                return "neg"
            if r == "adv" and ch.get("pos") == "verb" and (ch.get("type") or "").startswith("infinitive absolute"):
                return "emph"
            return r
        if ch.get("class") == "pron" and ch.get("type") == "personal":
            return "s"
        return "cj" if ch.get("class") == "cj" else "lead"
    r = role_of(ch)
    if r:
        return r
    return "cl" if ch.get("class") == "cl" else "x"


ROLE_KINDS = {"v", "s", "o", "o2", "io", "pp", "adv", "p", "neg", "emph"}


def clause(n, cx):
    out, run, question = [], [], False
    for ch in n:
        k = kind(ch)
        if ch.tag == "w" and ch.get("class") == "ptcl" and ch.get("type") == "interrogative":
            cx.seen.append(ch.get(XMLID))
            question = True
            continue
        if k == "v" and ch.tag == "w":
            run.append(("v", None, ch))              # composed in flush(), once negation is known
            continue
        toks = realize(ch, cx)
        if k in ROLE_KINDS:
            run.append((k, toks, ch))
            continue
        out += flush(run, cx)
        run = []
        if k == "cj" and out and not out[-1].p and toks:
            out.append(T(",", p=True))
        out += toks
    out += flush(run, cx)
    if question and out:
        out.append(T("?", p=True))
    return out


def flush(run, cx):
    if not run:
        return []
    kinds = [k for k, _, _ in run]
    vi = kinds.index("v") if "v" in kinds else -1
    verse = next((t.v for _, toks, _ in run for t in (toks or [])), 0)
    take = lambda *ks: [r for r in run if r[0] in ks]       # noqa: E731
    subj, objs = take("s"), take("o", "o2", "io")
    front = [r for i, r in enumerate(run) if r[0] in ("pp", "adv") and 0 <= vi and i < vi]
    rest = [r for i, r in enumerate(run) if r[0] in ("pp", "adv", "p") and r not in front]
    out = []
    for r in front:
        out += r[1]
    if vi >= 0:
        ventries = take("v")
        leaf_v = next((r for r in ventries if r[1] is None), None)
        vnode = leaf_v[2] if leaf_v else None
        vtype = (vnode.get("type") or "") if vnode is not None else ""
        verse = verse_of(vnode) if vnode is not None else verse
        neg = bool(take("neg")) and vnode is not None and (
            vtype in FINITE or vtype.startswith("infinitive") or vtype.startswith("participle"))
        for r in subj:
            out += r[1]
        if vnode is not None and not subj and vtype in ("qatal", "wayyiqtol", "yiqtol", "weqatal"):
            pron = pgn_pronoun(vnode)
            if pron:
                out.append(T(pron, [], verse))
                cx.flag(verse, "subject %r added from the verb ending" % pron)
        if not neg:
            for r in take("neg"):
                out += r[1]
        for r in take("emph"):
            same = vnode is not None and lex.raw_gloss(r[2].get("strongnumberx")) == lex.raw_gloss(vnode.get("strongnumberx"))
            if same:
                out.append(T("surely", [r[2].get(XMLID)], verse))
                cx.flag(verse, "infinitive absolute read as emphasis ('surely')")
            else:
                out.append(T(verb_simple(r[2], cx), [r[2].get(XMLID)], verse))
        for r in ventries:
            if r[1] is not None:                         # a verb phrase already realized by the tree walk
                out += r[1]
                continue
            node = r[2]
            cx.seen.append(node.get(XMLID))
            base = lexical(node, cx, verb=True)
            text, note = verb_form(base, node, neg if node is vnode else False)
            out.append(T(text, [node.get(XMLID)], verse_of(node) or verse))
            who = pgn_pronoun(node)
            cx.hint(verse, "%s <- %s%s%s" % (text, note, "/" + node.get("stem") if node.get("stem") else "",
                                             " " + who if who else ""))
            if (node.get("stem") or "") in ("piel", "hiphil", "pual", "hophal", "hithpael", "hitpolel", "polel"):
                cx.flag(verse, "%s %s: the stem may change the sense of '%s'" % (node.get("stem"), node.get("lemma"), base))
        for r in objs:
            out += r[1]
    else:
        for r in subj:
            out += r[1]
        preds = take("p")
        if subj and preds:
            sub = [t.t for r in subj for t in r[1]]
            last = sub[-1] if sub else ""
            out.append(T("am" if last == "I" else "are" if last in ("we", "you", "they") or last.endswith("s") else "is"))
            cx.flag(verse, "verbless clause: 'is/are' added, tense unknown")
        for r in objs:
            out += r[1]
    for r in rest:
        out += r[1]
    return out


def fix(toks):
    """Small English clean-ups on the finished token list."""
    out = []
    for t in toks:
        if out and not t.p and not out[-1].p:
            a, b = out[-1].t.lower(), t.t.lower()
            if a == "the" and b in DEMO | POSS:
                out.pop()
            elif a in POSS and b == "the":
                continue
            elif a == b and a in ("the", "to"):
                continue
            elif b.startswith("to ") and a == "to":
                out.pop()
        out.append(t)
    return out


def verse_text(toks):
    s = ""
    for t in toks:
        s += t.t if (t.p or not s) else " " + t.t
    s = re.sub(r"\s+([,.;:?])", r"\1", s).strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"([,;:])\s*([,;:])", r"\2", s)
    s = re.sub(r"([?.])\s+([a-z])", lambda m: m.group(1) + " " + m.group(2).upper(), s)
    if s and s[-1] not in ".?!":
        s += "."
    return s[:1].upper() + s[1:] if s else s


def render(ref):
    path = fetch.fetch(ref)
    root = ET.parse(path).getroot()
    cx = Ctx()
    all_ids = [w.get(XMLID) for w in root.iter("w")]
    toks = []
    for sent in root.iter("sentence"):
        for wg in sent.findall("wg"):
            toks += realize(wg, cx)
    toks = fix(toks)
    last = next((t.v for t in toks if t.v), 0)
    for t in toks:                               # words the rules add (of, is, commas) belong to the verse around them
        if t.v:
            last = t.v
        else:
            t.v = last
    verses, heb = {}, {}
    for w in root.iter("w"):
        v = verse_of(w)
        heb[v] = heb.get(v, "") + (w.text or "") + (w.get("after") or "")
    for t in toks:
        verses.setdefault(t.v, []).append(t)
    book, chapter = fetch.split_ref(ref)
    out = {
        "ref": ref,
        "source": "MACULA Hebrew (WLC lowfat) @ %s; STEPBible TBESH Gloss @ %s" % (fetch.PIN, lex.PIN),
        "coverage": {"words": len(all_ids), "visited": len(cx.seen), "visited_once": len(set(cx.seen)) == len(cx.seen),
                     "missing": sorted(set(all_ids) - set(cx.seen))[:10], "no_gloss": cx.nogloss},
        "unknown_rules": sorted(cx.unknown),
        "verses": [{
            "n": v, "hebrew": heb[v].strip(), "literal": verse_text(verses.get(v, [])),
            "ids": sorted({i for t in verses.get(v, []) for i in t.ids}),
            "keep": sorted(set(cx.keep.get(v, []))), "hints": cx.hints.get(v, []), "flags": cx.flags.get(v, []),
        } for v in sorted(set(heb))],
    }
    OUT.mkdir(exist_ok=True)
    target = OUT / (fetch.slug(book, chapter) + ".json")
    if target.exists():                          # re-running the draft must never lose smoothed text
        old = json.loads(target.read_text(encoding="utf8"))
        prev = {v["n"]: v for v in old.get("verses", [])}
        for v in out["verses"]:
            for k in ("final", "note", "rename"):
                if k in prev.get(v["n"], {}):
                    v[k] = prev[v["n"]][k]
        if "smoothed" in old:
            out["smoothed"] = old["smoothed"]
    target.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    return out


if __name__ == "__main__":
    r = render(" ".join(sys.argv[1:]))
    print(r["coverage"], r["unknown_rules"])
    for v in r["verses"]:
        print(v["n"], v["literal"])
