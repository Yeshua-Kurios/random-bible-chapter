# KJV27 handoff

Last updated 2026-10-18.

## Project
KJV27 (an unofficial, internal name for personal use; the project was first called PAR, "Pastorally Affirmed Rendering") is the KJV in clear modern English: NO archaic English at all, and poor KJV renderings corrected (see `par/STYLE.md`). It is still not a fresh translation from Hebrew or Greek. Free models draft, one checker reviews, and a person is the final reviewer. Owner's goal (2026-10-18): a solid translation without wasting tokens.

## Direction change (2026-10-18)
The plan was briefly a from-source translation (WLC/SBLGNT). It was tried and parked. What the experiment showed, in case it is revisited:
- Drafting Psalm 23 from the Hebrew alone made the model recall the KJV/ESV wording rather than translate. Adding a per-word gloss step stopped that, but the drafts then had real grammar errors (subject/object swaps, "even though" read as "also because").
- The checkers' suggested fixes were the familiar English wording, so a revision pass brought the memorized text back. That is fine for modernizing the KJV but defeats a from-source translation.
- Free tiers are thin: Cerebras and SambaNova now need billing, Z.ai has no balance, Scaleway is quota-locked, Mistral rate-limits, NVIDIA takes 60-90 s a call. Groq and Gemini were the reliable ones.
- The two-step gloss pipeline is in git history (commit c11160e and earlier on this branch).

## Design rules
- Keep verse count, verse order and the `#` paragraph markers exactly as in `kjv/`.
- No archaic English (the gate rejects thee/thou/-eth/wherefore/behold/yea etc.). Keep theological words that are still living English; fix clear mistranslations, and report each one in the verse's `note` so the review file shows it. Do not paraphrase.
- Deterministic gate (in `par/pipeline/dryrun.py`): same verses in order, paragraph markers kept, no `[bracketed]` words, no thee/thou/hath/-eth forms left. All five hand-made pilot chapters pass it.
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
4. Mention in the PR what was polished, then proceed with the update. Chapters with `fidelity`/`style` = `error` in `par/progress.json` were never LLM-checked, so give those the closest read.

## Open decisions (ask the owner)
1. Whether the five hand-made pilot chapters (`par/pilot-*.json`) should be published in the app now. They are not in `par/progress.json`, so the app shows the KJV for them.
2. What to do with chapters set aside after 3 failed tries (`failed` in `par/progress.json`).

## State
- Pilot: `par/pilot-{genesis-1,psalms-23,isaiah-53,john-3,romans-8}.json` plus `par/STYLE.md` and `par/NOTES.md`, copied from the par-pilot branch (PR #19).
- Pipeline: `par/pipeline/{config.json,dryrun.py,daily.py}`. `dryrun.py` modernizes one chapter; `daily.py` picks the next chapters from `par/queue.json`, writes `par/text/<book>-<n>.json` (what the app reads), `par/review/<book>-<n>.md` and `par/progress.json`.
- Workflows: `par-dryrun.yml` (manual test, one job per chapter) and `par-daily.yml` (the schedule). Scheduled workflows only run from the default branch, so the daily job starts once this is merged to main. It runs at 09:00 and 10:00 UTC and lets through only the run that lands in 5-6 am Eastern, once per day. The PR step needs Actions to be allowed to create pull requests (repo or org setting); if not, it pushes the branch and warns.
- A run stops after 3 failed chapters (a provider outage), so an outage cannot burn through the queue.
- App: Settings > LLM Usage shows the token meter; the ledger is `par/usage.json`, updated by `dryrun.py`.
- No model-drafted chapter has been accepted yet.

## Providers (OpenAI-compatible; org secrets, repo needs access to each)
Working: groq (`openai/gpt-oss-120b`), gemini (`gemini-3.5-flash`), nvidia (`nvidia/nemotron-3-super-120b-a12b`, slow). Keys: GROQ_API_KEY, GEMINI_API_KEY, NVIDIA_API_KEY. The other providers' keys and `CLOUDFLARE_ACCOUNT_ID` are set but unused. Run `dryrun.py --list-models` to re-check IDs.

## Gotchas
- Update prompt: the deploy workflow replaces `__BUILD__` in `index.html` with the commit SHA and writes `version.json`; the app compares them and shows a Reload banner. Keep `__BUILD__` in `index.html` (meta tag and the `?v=` on styles and scripts) and add new scripts with `?v=__BUILD__`. An unstamped copy (local file, or a host that does not run the deploy workflow) simply never prompts.
- The deploy workflow publishes the whole repo folder (`.assetsignore` hides par/pipeline and par/HANDOFF.md): never commit keys.
- Agreement among free models is evidence, not proof.
- GitHub only shows a job's log when the whole job finishes; the matrix gives one job per chapter for that reason.

## TODO
1. Merge to main, then run `KJV27 daily` once by hand (Actions > KJV27 daily > Run workflow) and check the PR it opens.
2. Compare the first batches to the hand-made pilots and tune STYLE.md and the prompts.
3. Decide the open items above.
