"""Checks for the mechanical stage. Run: python par/pipeline/mech/test_mech.py
The English rules need nothing; the Jeremiah 3 checks fetch the pinned data on first run (par/mech-cache/)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import english as e
import gate
import render

# --- English inflection ---------------------------------------------------------------------------------
assert e.pluralize("man") == "men" and e.pluralize("wife") == "wives" and e.pluralize("city") == "cities"
assert e.pluralize("house of David") == "houses of David" and e.pluralize("bush") == "bushes"
assert e.past("say") == "said" and e.past("go up") == "went up" and e.past("walk") == "walked"
assert e.past("be able", "second", "singular") == "were able" and e.past("be", "third", "singular") == "was"
assert e.past("sin") == "sinned" and e.past("stop") == "stopped" and e.past("marry") == "married"
assert e.participle("see") == "seen" and e.participle("defile") == "defiled"
assert e.gerund("go") == "going" and e.gerund("die") == "dying" and e.gerund("make") == "making"


class W(dict):
    """A stand-in for an XML word: attributes by get()."""


def word(**kw):
    w = render.ET.Element("w", {k: v for k, v in kw.items()})
    return w


# --- verb forms from the tags (no lexicon needed) -------------------------------------------------------
v = lambda typ, **kw: word(type=typ, person=kw.get("person", "third"), number=kw.get("number", "singular"),  # noqa: E731
                           gender=kw.get("gender", "masculine"), stem=kw.get("stem", "qal"))
assert render.verb_form("say", v("wayyiqtol"), False)[0] == "said"
assert render.verb_form("say", v("qatal"), True)[0] == "did not say"
assert render.verb_form("go", v("yiqtol"), False)[0] == "will go"
assert render.verb_form("go", v("yiqtol"), True)[0] == "will not go"
assert render.verb_form("defile", v("qatal", stem="niphal", person="third", gender="feminine"), False)[0] == "was defiled"
assert render.verb_form("return", v("imperative", person="second"), False)[0] == "return"
assert render.verb_form("return", v("imperative", person="second"), True)[0] == "do not return"
assert render.verb_form("say", v("infinitive construct", person=""), False)[0] == "to say"
assert render.verb_form("be", v("qatal", person="second"), False)[0] == "were"
assert render.verb_form("be", v("qatal", person="second"), True)[0] == "were not"
assert render.verb_form("be ashamed", v("qatal", stem="niphal"), False)[0] == "was ashamed"   # no double passive

# --- clause order from a small tree ---------------------------------------------------------------------
XML = """<wg class="cl" rule="V-S-O" xmlns:xml="http://www.w3.org/XML/1998/namespace">
 <w role="v" xml:id="a" class="verb" pos="verb" type="wayyiqtol" stem="qal" person="third" gender="masculine" number="singular"
    strongnumberx="0559" ref="X 1:1!1"/>
 <w role="s" xml:id="b" class="noun" pos="noun" type="common" strongnumberx="0376" number="singular" ref="X 1:1!2"/>
</wg>"""
node = render.ET.fromstring(XML)
cx = render.Ctx()
toks = render.realize(node, cx)
assert [t.t for t in toks] == ["man", "said"], [t.t for t in toks]     # subject before verb, Hebrew V-S became S-V
assert sorted(cx.seen) == ["a", "b"]

# --- Jeremiah 3 end to end ------------------------------------------------------------------------------
out = render.render("Jeremiah 3")
cov = out["coverage"]
assert cov["words"] == cov["visited"] == 613 and cov["visited_once"] and not cov["missing"] and not cov["no_gloss"], cov
assert len(out["verses"]) == 25
text = {v_["n"]: v_["literal"] for v_ in out["verses"]}
assert "in days of Josiah" in text[6] and "LORD said" in text[6]
assert "all high mountain" in text[6] and "all luxuriant tree" in text[6], text[6]   # adjective moved before its noun
assert "his wife" in text[1] or "his woman" in text[1]                     # possessive ending moved in front
assert "declares of" not in " ".join(text.values())                         # 'declares the LORD' is a formula, no 'of'
assert render.render("Jeremiah 3") == out                                   # same input, same output

# --- gate -----------------------------------------------------------------------------------------------
errs, warns = gate.check("jeremiah-3") if (Path(__file__).resolve().parents[2] / "mech" / "jeremiah-3.final.json").exists() else ([], [])
assert not errs, errs
print("ok")
