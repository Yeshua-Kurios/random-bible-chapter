# PAR handoff

Last updated 2026-10-18.

## Project
PAR = Pastorally Affirmed Rendering: a light modernization of the KJV English (see `par/STYLE.md`). It is NOT a new translation from Hebrew or Greek. Free models draft the modernization, other models cross-check, and a person is the final reviewer.

## Direction change (2026-10-18)
The plan was briefly a from-source translation (WLC/SBLGNT). It was tried and parked. What the experiment showed, in case it is revisited:
- Drafting Psalm 23 from the Hebrew alone made the model recall the KJV/ESV wording rather than translate. Adding a per-word gloss step stopped that, but the drafts then had real grammar errors (subject/object swaps, "even though" read as "also because").
- The checkers' suggested fixes were the familiar English wording, so a revision pass brought the memorized text back. That is fine for modernizing the KJV but defeats a from-source translation.
- Free tiers are thin: Cerebras and SambaNova now need billing, Z.ai has no balance, Scaleway is quota-locked, Mistral rate-limits, NVIDIA takes 60-90 s a call. Groq and Gemini were the reliable ones.
- The two-step gloss pipeline is in git history (commit c11160e and earlier on this branch).

## Design rules
- Keep verse count, verse order and the `#` paragraph markers exactly as in `kjv/`.
- Keep the weighty KJV vocabulary the style guide lists; do not paraphrase.
- Deterministic gate (in `par/pipeline/dryrun.py`): same verses in order, paragraph markers kept, no `[bracketed]` words, no thee/thou/hath/-eth forms left. All five hand-made pilot chapters pass it.
- LLM checkers: fidelity (meaning kept) and style (STYLE.md rules). One revision pass on flagged verses, then re-check.
- Judgment calls go in `par/NOTES.md`. A person reviews before anything is published.
- One chapter per file (a very large write was content-filtered once). Split Psalm 119.

## Open decisions (ask the owner)
1. Daily job: about 5 chapters/day (1,189 chapters, about 238 days), one fresh session per run, draft PR each day. Chapter order and run time.
2. Where the modernized text shows up in the app (a toggle next to the KJV reader, in a separate PR).
3. How the person reviews: PR review per chapter, or a batch.

## State
- Pilot: `par/pilot-{genesis-1,psalms-23,isaiah-53,john-3,romans-8}.json` plus `par/STYLE.md` and `par/NOTES.md`, copied from the par-pilot branch (PR #19).
- Pipeline: `par/pipeline/{config.json,dryrun.py}` and `.github/workflows/par-dryrun.yml` (one job per chapter, Psalm 23 and John 3).
- App: Settings > LLM Usage shows the token meter; the ledger is `par/usage.json`, updated by `dryrun.py`.
- No model-drafted chapter has been accepted yet.

## Providers (OpenAI-compatible; org secrets, repo needs access to each)
Working: groq (`openai/gpt-oss-120b`), gemini (`gemini-3.5-flash`), nvidia (`nvidia/nemotron-3-super-120b-a12b`, slow). Keys: GROQ_API_KEY, GEMINI_API_KEY, NVIDIA_API_KEY. The other providers' keys and `CLOUDFLARE_ACCOUNT_ID` are set but unused. Run `dryrun.py --list-models` to re-check IDs.

## Gotchas
- The deploy workflow publishes the whole repo folder (`.assetsignore` hides par/pipeline and par/HANDOFF.md): never commit keys.
- Agreement among free models is evidence, not proof.
- GitHub only shows a job's log when the whole job finishes; the matrix gives one job per chapter for that reason.

## TODO
1. Run the workflow on Psalm 23 and John 3, compare to the hand-made pilots, tune STYLE.md and the prompts.
2. Decide the daily job (open decision 1) and add `par/PROGRESS.json`.
3. App toggle for the modernized text, in a separate PR.
