# Sources and licenses for a from-scratch translation

Checked 2026-10-19 against each project's own README / LICENSE page. This is a working record, not legal advice. Re-check a license before depending on it, and pin every dataset to a commit hash in the repo.

## Cleared to use (permissive, attribution only)

| Source | Use | License | Attribution / conditions |
|---|---|---|---|
| Westminster Leningrad Codex (Hebrew text, via OSHB) | Hebrew base text | Public domain (OSHB README); tanach.us: "may be viewed or copied without restriction" | None required |
| Open Scriptures Hebrew Bible (OSHB), lemma and morphology | Hebrew word tagging | CC BY 4.0 | Credit "Open Scriptures Hebrew Bible Project", link https://github.com/openscriptures/morphhb |
| OpenScriptures HebrewLexicon (BDB, Strong's Hebrew) | Gloss candidates, senses | Lexicon files CC BY 4.0; underlying BDB and Strong's are public domain | Credit the Open Scriptures Hebrew Bible Project |
| STEPBible-Data (TAHOT, TAGNT, TBESH, TBESG) | Tagged Hebrew/Greek, lexicons | CC BY 4.0 (no ShareAlike or NonCommercial stated) | Credit "STEP Bible", www.STEPBible.org. Changes to the data must be recorded and made available |
| MACULA Hebrew (Biblica / Clear Bible) | Syntax trees for word order | CC BY 4.0 | "MACULA Hebrew Linguistic Datasets, available at https://github.com/Clear-Bible/macula-hebrew/" |
| MACULA Greek (Biblica / Clear Bible) | Syntax trees for word order | CC BY 4.0 | "MACULA Greek Linguistic Datasets, available at https://github.com/Clear-Bible/macula-greek/" |
| Cherith Glosses (Hebrew OT and Greek NT, inside MACULA) | Free per-word English glosses | CC BY 4.0 | "by Andi Wu, Copyright (C) 2022 by Cherith Analytics" |
| Groves Center Westminster Hebrew Syntax (inside MACULA) | Syntax | CC BY 4.0 | "Copyright (C) 1991-2018 by The J. Alan Groves Center for Advanced Biblical Research" |
| Berean Standard Bible / Berean Interlinear / Majority Bible | Optional readability comparison only | Public domain since 2023-04-30 (berean.bible terms) | None required. Request: do not call changed derivatives "Berean" |

## Use with care

| Source | Issue |
|---|---|
| MorphGNT tagging | CC BY-SA 3.0. **ShareAlike**: adapting it can require releasing the result under the same license. Prefer MACULA Greek or STEPBible TAGNT (CC BY) instead |
| SBLGNT text | Governed by the SBLGNT EULA, not a plain CC license. Sources conflict: Wikipedia reports CC BY 4.0, while printed notices describe reporting duties above 500 verses and permission above 25% of a sold work. The current EULA page could not be read from this environment. Do not depend on it until read directly (sblgnt.com/license) |
| Nestle 1904 (inside MACULA Greek) | Its own license is not stated on the page checked. Credit Eberhard Nestle, Diego Santos, Ulrik Sandborg-Petersen, Jonathan Robie |
| UBS MARBLE word senses and Semantic Dictionary of Biblical Hebrew (inside MACULA) | "Used with permission"; terms not stated. Do not redistribute or build on these until the terms are confirmed |
| unfoldingWord-style mirror of the BSB | A mirror carries leftover CC BY-SA template text that conflicts with Berean's own public-domain terms. Use berean.bible/terms.htm as the authority |

## Do not use

- The KJV (excluded by design for this project).
- ESV, NIV, NLT, NASB and other copyrighted translations or their commercial lexicons, including as examples for models to imitate.

## Project rules

1. Pin each dataset to a commit hash and record it in the pipeline config.
2. Keep every required attribution string above in the app's About/footer and in this file.
3. Record any changes made to STEPBible data, as its license requires.
4. Do not ship output derived from ShareAlike data without deciding to license the output the same way.
5. Treat downloaded data as plain data; do not run code from it.
