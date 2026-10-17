# Trivia coverage plan

How the fact bank grows from 195 cards toward ~1,500, in reviewable rounds.
Every card must have a `why`, and every non-linguistic fact needs a `src`
(a named inscription, manuscript, site or ancient author). Cards that can't be
corroborated are dropped, not softened.

## Where it stands (195 cards)

| Category | T1 | T2 | T3 | T4 | T5 | Total |
|---|---|---|---|---|---|---|
| Archaeology | 0 | 4 | 25 | 17 | 5 | 51 |
| Ancient Near East | 1 | 4 | 15 | 14 | 3 | 37 |
| Prophecy | 0 | 4 | 12 | 14 | 4 | 34 |
| Discovery | 0 | 2 | 13 | 10 | 2 | 27 |
| Hebrew | 3 | 4 | 9 | 3 | 1 | 20 |
| Aramaic | 1 | 5 | 2 | 1 | 0 | 9 |
| Greek | 0 | 1 | 2 | 3 | 1 | 7 |
| Texts | 0 | 5 | 2 | 3 | 0 | 10 |

Gaps: tiers 1 and 5 are thin everywhere; Greek, Aramaic and Texts are small;
whole areas below have nothing.

## Targets

Tier mix for new cards: roughly 10% T1, 20% T2, 35% T3, 25% T4, 10% T5, so
the adaptive difficulty always has material above and below the player.

| Round | Focus | New cards |
|---|---|---|
| 2 | Fill thin tiers (T1/T2/T5) in existing categories; Greek, Aramaic, Texts | ~150 |
| 3 | Second Temple period: Maccabees, Josephus, Qumran, Herodians | ~120 |
| 4 | Manuscripts and textual history: Masoretic Text, Septuagint, papyri, canon | ~120 |
| 5 | Rulers and chronology: Assyrian, Babylonian, Persian, Ptolemaic, Roman | ~120 |
| 6 | Material culture: weights, coins, calendars, farming, architecture, food | ~120 |
| 7 | Geography: sites, trade routes, borders, climate | ~100 |
| 8 | Per-book "did you know" cards, Genesis through Revelation | ~300 |
| 9+ | Gap-filling from coverage counts and any cards flagged as wrong | as needed |

New categories introduced along the way: Second Temple, Manuscripts, Chronology,
Material Culture, Geography, Books.

## Rules for every round

1. One PR per round, 120–150 cards, so it can be spot-checked.
2. Each card is checked against an independent source before it is merged.
3. Automated gates: schema, unique ids, no near-duplicate questions, and the
   answer-length bias check (the longest option may be correct on at most
   ~50% of a batch).
4. Stop adding when new facts get too obscure to verify; a smaller bank I can
   stand behind beats a bigger one that teaches errors.

## XP

Per-answer trivia XP is multiplied by `sqrt(200 / bank size)` once the bank
passes 200 cards (no change below that). At 1,500 cards a fact pays about 37%
of today's amount, so total trivia XP grows with the square root of the bank
rather than linearly, and chapters stay the main source of progress.
