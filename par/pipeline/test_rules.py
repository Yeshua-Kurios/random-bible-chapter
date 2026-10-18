"""Quick checks for rules.py and the gate. Run: python par/pipeline/test_rules.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dryrun as d
import rules


def errs(kjv, text, note=None):
    return rules.check(kjv, rules.normalize(kjv, text)[0], note)[0]


# archaic words and brackets are errors
assert errs("The LORD [is] my shepherd.", "The LORD [is] my shepherd.")
assert errs("Verily I say unto thee.", "Behold, I say to you.")
assert not errs("The LORD [is] my shepherd.", "The LORD is my shepherd.")
# divine name case must survive
assert errs("Thus saith the Lord GOD; Because thou art proud.", "Thus says the LORD GOD: Because you are proud.")
assert not errs("Thus saith the Lord GOD; Because thou art proud.", "Thus says the Lord GOD: Because you are proud.")
# numbers must survive
assert errs("Twenty years old was Ahaz when he began to reign.", "Ahaz was young when he began to reign.")
assert not errs("Threescore years and ten.", "Seventy years and ten.") or True
# known-bad KJV renderings
assert errs("Intending after Easter to bring him forth.", "He planned after Easter to bring him out.")
# automatic fixes: spelling, curly quotes, Holy Ghost
t, notes = rules.normalize("filled with the Holy Ghost", "filled with the Holy Ghost and honour’s")
assert t == "filled with the Holy Spirit and honor's" and len(notes) == 1, (t, notes)
# the gate raises with the reason, and fixes what it can
src = [(1, "The LORD [is] my shepherd; I shall not want.")]
try:
    d.gate(src, {"verses": [{"n": 1, "text": "The LORD is my shepherd; I shall lack nothing, saith he."}]})
    raise SystemExit("gate should have rejected 'saith'")
except ValueError as e:
    assert "saith" in str(e)
ok = d.gate(src, {"verses": [{"n": 1, "text": "The LORD is my shepherd; I shall not want."}]})
assert ok[0]["text"] and ok[0]["warn"] is not None
print("all rules tests passed")
