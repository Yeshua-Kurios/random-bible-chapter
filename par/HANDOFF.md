# KJV27 handoff

Last updated 2026-10-18 (end of session, after PR #26).

## Project
KJV27 (an unofficial, internal name for personal use; the project was first called PAR, "Pastorally Affirmed Rendering") is the KJV in clear modern English: NO archaic English at all, and poor KJV renderings corrected (see `par/STYLE.md`). It is still not a fresh translation from Hebrew or Greek. Free models draft, one checker reviews, and a person is the final reviewer. Owner's goal (2026-10-18): a solid translation without wasting tokens.

## Direction change (2026-10-18)
The plan was briefly a from-source translation (WLC/SBLGNT). It was tried and parked. What the experiment showed, in case it is revisited:
- Drafting Psalm 23 from the Hebrew alone made the model recall the KJV/ESV wording rather than translate. Adding a per-word gloss step stopped that, but the drafts then had real grammar errors (subject/object swaps, "even though" read as "also because").
- The checkers' suggested fixes were the familiar English wording, so a revision pass brought the memorized text back. That is fine for modernizing the KJV but defeats a from-source translation.
- Free tiers are thin: Cerebras and SambaNova now need billing, Z.ai has no balance, Scaleway is quota-locked, Mistral rate-limits, NVIDIA takes 60-90 s a call. Groq and Gemini were the reliable ones.
- The two-step gloss pipeline is in git history (commit c11160e and earlier on this branch).

## From-source track (2026-10-19, owner's request)
The owner wants the text translated from the Hebrew and Greek with no KJV in the process, as mechanically as possible: a mechanical stage, free LLMs to smooth it, Claude to review on request. The Oct 18 experiment above (models recalled the KJV/ESV instead of translating) is the reason the mechanical stage does the translating and models only smooth.
- Code: `par/pipeline/mech/` (read its docstrings). `fetch.py` pins MACULA Hebrew; `lex.py` reads only the STEPBible TBESH Gloss column; `english.py` inflects; `render.py` turns the syntax tree into a literal English draft with every source word accounted for; `gate.py` checks the smoothed text; `publish.py` joins draft and smoothed text, runs the gate and writes `par/text/`, `par/review/`, `par/progress.json`. Tests: `python par/pipeline/mech/test_mech.py` (fetches pinned data on first run).
- Data flow per chapter: `render.py "Jeremiah 3"` writes `par/mech/jeremiah-3.json` (literal draft, hints, flags). Smoothing (a free model, Claude, or a person) writes `par/mech/jeremiah-3.final.json`. `publish.py "Jeremiah 3"` runs the gate and publishes only if there are no errors. Re-running render never loses smoothed text.
- Decisions in `par/pipeline/mech/glossary.json` (keyed by Strong number) override the lexicon: add one whenever a word is ruled on, so it is never decided twice.
- First chapter: Jeremiah 3 (the next queued chapter with no text). Smoothed by Claude in a session with no API keys, standing in for the free-model pass. The gate passes with 6 warnings, all KJV-overlap on phrases the Hebrew forces ("the LORD our God").
- Not done yet: Greek (`macula-greek` has one file per book; the same code should work with a new fetch step), the free-model smoothing script (the daily workflow still runs the old KJV27 pipeline), versification differences between the Hebrew and the English chapters (the gate only compares verse counts), the in-app credit lines the CC BY sources require (`par/SOURCES.md`), and whether the app should still call this text "KJV27".
- Known rough edges of the draft: tense for `weqatal` is guessed, hiphil and piel are not given causative or intensive senses (flagged per verse), and lexicon glosses are first senses, so vocabulary is plain and sometimes odd until the smoothing pass.

## Design rules
- Keep verse count, verse order and the `#` paragraph markers exactly as in `kjv/`.
- No archaic English (the gate rejects thee/thou/-eth/wherefore/behold/yea etc.). Keep theological words that are still living English; fix clear mistranslations, and report each one in the verse's `note` so the review file shows it. Do not paraphrase.
- Deterministic gate (`gate()` in `par/pipeline/dryrun.py`, which calls `rules.py`): same verses in order, paragraph markers kept, no `[bracketed]` words, no archaic forms. The four chapters in `par/text/` pass it with 0 errors and 0 warnings; the five older hand-made pilots predate it (they still contain "Behold" etc.).
- Deterministic rules (`par/pipeline/rules.py`, tests in `test_rules.py`, run before any model reviews a verse): auto-fixes (British to American spelling, curly quotes, Holy Ghost, publican, candlestick, unicorn, cockatrice, each auto-noted); hard errors sent back to the drafter (archaic words, brackets, paragraph markers, unbalanced quotes, LORD/GOD changed, a number dropped, length blown up or summarized, known-bad KJV words like Easter/charity/God forbid); warnings for the reviewer and the review file (unexplained heavy rewording, missing names, shall/meat/corn/hell/conversation kept). Extend the lists in rules.py when a reviewer catches something a rule could have caught.
- Token frugality: ONE reviewer call per chapter (meaning + style together, `review` in config), one revision pass on flagged verses only, and the re-check sends only the revised verses.
- Judgment calls go in `par/NOTES.md`. A person reviews before anything is published.
- One chapter per file (a very large write was content-filtered once). Split Psalm 119.

## Decided (2026-10-18)
- Daily job: 5 chapters a day at 5 am US Eastern, in the app's random order (`par/queue.json`), as a GitHub Actions workflow (`par-daily.yml`) that opens one PR per day. A GitHub Actions run, not a Claude session, because the free-model keys are org secrets that only Actions can see. About 238 days for 1,189 chapters.
- Review: the person reviews each day's PR (KJV beside KJV27 in `par/review/`). Merging is the approval.
- Random order: `par/queue.json` is one fixed shuffle of all 1,189 chapters (made by `par/pipeline/make_queue.py`, seed 20261018). In the first read-through the app's Get/Skip/Mark hand out the next unread chapter in that order (skip sends a chapter to the back of the line); the daily job modernizes the same order, so KJV27 text is ready for what is read next. After a first full read-through, or if the file can't load, the app picks random unread chapters as before. Don't change the seed once reading has started.
- Optional, for the daily job to skip chapters already read: add an org/repo secret `READING_LOG_TOKEN` (a fine-grained, read-only token with Contents access to the private repo the app syncs its reading log to). Without it the job starts at the head of the queue, so chapters read before the first PR merges may get KJV27 text nobody sees.
- App: the reader shows KJV27 for chapters listed in `par/progress.json` and the KJV for all others, with a per-reader toggle back to the KJV (remembered in the browser).

## Standing instruction (2026-10-18, from the owner)
Whenever the owner asks for an app update, FIRST review the KJV27 queue and optimize what the free LLMs produced, THEN do the requested update. Concretely:
1. Fetch main; list the chapters in `par/text/` (and `failed` in `par/progress.json`) that have not been human-polished.
2. Read each against its KJV (`par/review/<book>-<n>.md`) and `par/STYLE.md`: fix awkward or ungrammatical wording, meaning drift, and any style-guide misses. Keep verse count, order and `#` markers; keep the weighty KJV vocabulary.
3. Run the deterministic gate from `par/pipeline/dryrun.py` on every edited chapter; log judgment calls in `par/NOTES.md`.
4. When a chapter is polished, add study notes for it in `par/notes/` where you are confident (see the reader features section), and run `notes_check.py`.
5. Mention in the PR what was polished, then proceed with the update. Chapters with `review` (or old `fidelity`/`style`) = `error` in `par/progress.json` were never LLM-checked, and chapters without `review: hand-polished` have not been read by a person or Claude, so give those the closest read. If nothing new is in the queue, say so in the PR and move on.

(Working style the owner uses: PRs are opened as drafts; "merge" / "merge all" means mark ready and squash-merge every open PR. Keep the final summary short and say what was and was not tested.)

## Reader features added 2026-10-18 (owner's request)
- Tap a verse number: a small box opens at the verse to type a question and save it to the notebook (saved as KJV or KJV27), so you stay where you are. "Open notebook" jumps to the full notebook.
- "Back to verse N" pill (bottom right): appears when the verse you were reading is off screen (for example after scrolling to the notebook or map). It also appears on reload with "Resume at verse N". Saved in localStorage (`rbc:spot`). A stray scroll will not overwrite it until you read past it.
- Study notes: bold words with a dotted underline open a popup. Seven kinds: rare word, textual variant, Ancient Near East, archaeology, outside the Bible, prophecy fulfilled, canonical connection. Data: `par/notes/<book>-<n>.json`, listed in `par/notes/index.json`; validate with `python par/pipeline/notes_check.py` (anchors must exist in the text). `match` lists the phrase to bold, KJV27 wording first, KJV wording second. A toggle hides them. Only the four hand-polished chapters have notes so far. Rules for new notes: short (under 700 characters), name the source, hedge what scholars dispute, and only put under "Prophecy fulfilled" what independent historical records back up. Never invent a source or inscription number; leave it out.
- Chapter map: an offline SVG at the bottom of each chapter that mentions mapped places; pins for cities and mountains, faint labels for lands, faint anchor cities for orientation, tap a pin for the modern location and verses. `places.js` is the gazetteer (175 entries, 679 of 1,189 chapters have at least one); `python par/pipeline/places_check.py --top 40` validates it and shows coverage. `map-data.js` is generated from public-domain Natural Earth by `par/pipeline/build_map.py` (see its docstring); do not edit it by hand. Hollow pins are approximate or debated sites.
- Ideas not done: generating study notes automatically for the daily chapters (needs strict sourcing and the owner's review, because invented archaeology or prophecy claims would be worse than none); more places; a larger map for the New Testament voyages.

## Open decisions (ask the owner)
1. Whether the five hand-made pilot chapters (`par/pilot-*.json`) should be published in the app now. They are not in `par/progress.json`, so the app shows the KJV for them.
2. What to do with chapters set aside after 3 failed tries (`failed` in `par/progress.json`).

## State (2026-10-25 addendum)
- Revelation 11 drafted and polished by Claude in the unattended daily job (`review: hand-polished`, drafters `["claude (unattended)"]`); v11 ("breath of life") flagged for review. 3 study notes added (`par/notes/revelation-11.json`). Chapters named by stale `par/daily-*` branches (1 Chronicles 28, Psalms 3, 132, Numbers 9, Acts 27) were skipped as claimed.

## State (2026-10-24 addendum)
- Psalm 62 hand-polished by Claude (`review: hand-polished`, drafters `["claude"]`) and moved out of `failed` in `par/progress.json`; v3's Hebrew is disputed and flagged for review in `par/review/psalms-62.md` and `par/NOTES.md`. 3 study notes added (`par/notes/psalms-62.json`).
- The KJV27 daily job moved from a Claude cloud scheduled task to `.github/workflows/kjv27-daily-polish.yml` (GitHub Actions + `claude-code-action`, Sonnet 5.5, authenticated with `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`). The old `par-daily.yml` schedule is disabled (kept as `workflow_dispatch` only) so the two can't race. A model bake-off (`par/pipeline/bakeoff.py`, `.github/workflows/kjv27-model-bakeoff.yml`) compared Claude/GPT-5.1/Gemini/DeepSeek on 3 chapters; Claude was kept for the daily job.

## State (end of 2026-10-18 session; PRs #20-#26 are all merged to main)
- Pipeline: `par/pipeline/{config.json,dryrun.py,rules.py,daily.py,test_rules.py,make_queue.py}`. `dryrun.py` modernizes one chapter (draft in chunks of 12 verses, `rules.py` gate with retry, ONE `review` call, one revision pass on flagged verses, re-check of revised verses only). `daily.py` picks the next chapters from `par/queue.json`, writes `par/text/<book>-<n>.json` (what the app reads), `par/review/<book>-<n>.md` (KJV beside KJV27, correction notes, `check:` warnings) and `par/progress.json`. Run `python par/pipeline/test_rules.py` after touching the rules.
- Accepted chapters (hand-polished by Claude, `review: hand-polished`): 1 Peter 2, 2 Kings 16, Ezekiel 31, Proverbs 12. Verses resting on uncertain Hebrew are flagged in their notes and in `par/NOTES.md`. These are the only KJV27 chapters in the app; the five pilots are not published.
- Failed once each (`failed` in `par/progress.json`): 1 Chronicles 28, Jeremiah 3, Psalms 62. A chapter is set aside after 3 failures.
- First manual run of `KJV27 daily` (2026-10-18) took 40 minutes and produced 4 chapters, but every fidelity/style check errored (cause never found). The pipeline has since changed to ONE `review` call with groq, then gemini and nvidia as fallbacks, and the deterministic rules; none of that has run against real models yet. The first scheduled run is the real test: check its PR for `review: error` entries and for `check:` flags in `par/review/`, and read the run log if the reviewer errors again.
- That run's PR was not opened by Actions (it pushed `par/daily-2026-10-18` and warned), so Claude opened PR #21 by hand. Actions probably is not allowed to create pull requests: repo Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests". Until then, each daily run needs its PR opened by hand.
- Workflows: `par-dryrun.yml` (manual test, one job per chapter), `par-daily.yml` (09:00 and 10:00 UTC; only the run landing in 5-6 am Eastern goes ahead, once per day; a manual run always goes ahead), `deploy.yml` (GitHub Pages; stamps the build for the update prompt). A run stops after 3 failed chapters. Do not start two manual runs at once: both use the branch `par/daily-<date>` and the second fails at the push.
- App (all in `app.js`, `index.html`, `style.css`): the reader shows KJV27 for chapters in `par/progress.json` (toggle back to the KJV); a homepage "KJV27 queue" card shows how many of the next 20 unread queued chapters have KJV27 (skips go to the back, as in the app); Settings > LLM Usage shows the token meter from `par/usage.json`; a "new version available, Reload / Later" banner appears when a newer deploy exists (works only after one manual reload on devices that loaded the app before it shipped).

## Providers (OpenAI-compatible; org secrets, repo needs access to each)
Working: groq (`openai/gpt-oss-120b`), gemini (`gemini-3.5-flash`), nvidia (`nvidia/nemotron-3-super-120b-a12b`, slow). Keys: GROQ_API_KEY, GEMINI_API_KEY, NVIDIA_API_KEY. The other providers' keys and `CLOUDFLARE_ACCOUNT_ID` are set but unused. Run `dryrun.py --list-models` to re-check IDs.

## Gotchas
- Update prompt: the deploy workflow replaces `__BUILD__` in `index.html` with the commit SHA and writes `version.json`; the app compares them and shows a Reload banner. Keep `__BUILD__` in `index.html` (meta tag and the `?v=` on styles and scripts) and add new scripts with `?v=__BUILD__` (`map-data.js`, `places.js` and `app.js` are loaded that way). An unstamped copy (local file, or a host that does not run the deploy workflow) simply never prompts.
- The deploy workflow publishes the whole repo folder (`.assetsignore` hides par/pipeline and par/HANDOFF.md): never commit keys.
- Agreement among free models is evidence, not proof.
- GitHub only shows a job's log when the whole job finishes; the matrix gives one job per chapter for that reason.

## TODO
1. Open the live app, reload once by hand (so the update prompt starts working), and try the new reader: tap a verse number, scroll away and use the "Back to verse" pill, tap the bold study-note words and a map pin on 1 Peter 2, 2 Kings 16, Ezekiel 31 and Proverbs 12. Fix anything that feels wrong on a real phone (all testing so far was in headless Chromium).
2. Spot-check the 52 study notes in `par/notes/` (written from memory, not looked up), especially the archaeology, extrabiblical and prophecy ones, and correct or delete any you cannot stand behind.
3. After the first scheduled 5 am Eastern run: open its PR (or enable Actions to create PRs), read `par/review/` for the new chapters, check the reviewer errors and `check:` flags, and fix prompts, `STYLE.md` or `rules.py` accordingly. Merging that PR is the owner's approval.
4. Per the standing instruction, polish the new chapters (and add study notes for them) before the next app update.
5. Optional: add the `READING_LOG_TOKEN` secret so the daily job skips chapters already read.
6. Decide the open items above (publish the pilots? what to do with chapters set aside after 3 failures? whether to generate study notes automatically).
