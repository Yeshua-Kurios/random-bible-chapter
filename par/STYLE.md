# KJV27 style guide

KJV27 is the KJV made into clear, correct, modern English. It starts from the KJV text and its verse structure, with two jobs: remove every trace of archaic English, and correct places where the KJV renders the Hebrew or Greek poorly or misleadingly. It is not a fresh translation from the original languages. The name is an unofficial, internal one for personal use; it is not an official or published Bible version.

## Structure (never changes)
- Keep verse count, verse order, and the `#` paragraph markers exactly as in `kjv/`.

## No archaic English at all
- Remove the `[brackets]`, keeping the word when modern English needs it (`The LORD [is] my shepherd` becomes `The LORD is my shepherd`).
- thee/thou/thy/thine/ye become you/your/yours; -eth/-est verbs become plain modern forms.
- Modernize grammar as well as words: inverted negatives (`believeth not` becomes `does not believe`), `whence`/`whither`, `wherefore` (therefore / why), `whoso`/`whosoever` (whoever), `yea` (indeed / yes), `behold` (look / see, or drop it), `begat` (was the father of), `brethren` (brothers, or brothers and sisters where the context includes women), `spake` (spoke), `hearken` (listen), `wrought` (did, worked), `peradventure` (perhaps), `lest` (so that ... not / for fear that).
- Replace archaic words with their modern sense (meat becomes food, quicken becomes give life to, mortify becomes put to death, corn becomes grain, publican becomes tax collector, candlestick becomes lampstand).
- Verily, verily becomes Truly, truly.
- Keep LORD (small caps convention) for the divine name, and Son of Man capitalized.
- Keep theological words that are still living English (justified, righteous, grace, redeemed, firstborn, predestined). Replace ones that are not (only begotten becomes one and only; Holy Ghost becomes Holy Spirit; charity becomes love; damnation becomes judgment or condemnation).

## Fix places where the KJV translates poorly
- Correct a KJV rendering when you are confident it is a mistranslation or is now misleading: a wrong word (Easter in Acts 12:4 becomes Passover; unicorn becomes wild ox; cockatrice becomes viper), a word whose meaning has reversed (let in 2 Thess 2:7 becomes hinders; prevent becomes precede; suffer little children becomes let the little children come), a blurred distinction (Sheol, Hades and Gehenna rendered alike as hell), or a false impression (God forbid becomes Certainly not).
- Change only the part that is wrong. Keep the rest of the sentence, its order and its rhythm.
- If you are not confident, keep the KJV sense and flag the verse instead of changing it.
- Every such correction must be reported in the verse's `note` field (one short line: what changed and why). A person reviews all notes.

## Voice
- Plain, accurate, readable English. Keep poetic parallelism and the weight of the passage; do not paraphrase or smooth for style.
- Use gender-neutral wording only where the original clearly means people in general (`a man who` becomes `a person who`); keep male terms where the text is about a man.

## Judgment calls
- Where a rendering is a judgment call, note it in `par/NOTES.md`.
