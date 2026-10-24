# KJV27 daily polish — unattended prompt

You are running unattended inside a GitHub Actions workflow, not a Claude cloud session. You have a normal git checkout and the `gh` CLI, authenticated with `GH_TOKEN`. `add_repo` is not a concept here — you already have the whole repo on disk.

Read first, and follow their rules: `par/HANDOFF.md` ("Standing instruction", "Design rules", "Reader features"), `par/STYLE.md`, `par/NOTES.md`, `.github/copilot-instructions.md`.

**Hard rules, no exceptions:**
- Never touch `par/queue.json` or its seed. Before every commit, run `git diff --cached --name-only` and abort (exit non-zero, explain why in the step log) if `par/queue.json` appears.
- Never touch a chapter whose `par/progress.json` entry has `"source": "from-hebrew"` — those are translated by `par/pipeline/mech/`, not this job.
- Never push to `main`, never force-push, never merge, never enable auto-merge.
- Only work on the branch `claude/kjv27-<YYYY-MM-DD>` (America/New_York date). Create it from the latest `main`.
- Open at most one PR, as a **draft**, with `gh pr create --draft`.

## 1. Pick 1 chapter

- `git fetch origin main` and diff against it so you're working from the latest state.
- List open PRs (`gh pr list --state open --json headRefName,files`) and remote branches (`git ls-remote --heads origin`). Build a set of chapters already claimed: any chapter touched by an open PR, or by a branch matching `par/daily-*`, `claude/kjv27-*`, or `optimizer/*` (other than the one you are about to create). Skip those.
- **Priority (a) — polish existing drafts.** Look at `par/progress.json`. Any chapter in `par/text/` whose entry's `review` is **not** `"hand-polished"` and **not** `"mechanical + claude-smoothed"`, and whose `source` is not `"from-hebrew"`, is an unpolished free-model draft. Among these, read the ones whose `par/review/<slug>.md` has `review: error` or a `check:` warning first — they're most likely to have a real problem.
- **Priority (b) — draft new chapters.** Only after (a) is exhausted or none qualify: take the next chapters in `par/queue.json` `order` that have no `par/text/<slug>.json` file yet and are not in `progress.json`'s `failed` map with a strike count of 3. Draft these from `kjv/<book>.json` following `par/STYLE.md`.
- Stop at 1 chapter total across (a) and (b). If nothing qualifies at all, say so in one line (no PR) and stop — this is a normal, successful outcome, not a failure.

## 2. Polishing / drafting rules (par/STYLE.md)

- No archaic English at all (thee/thou/-eth/wherefore/behold/yea, etc. — see STYLE.md's full list).
- Fix clear KJV mistranslations; report each one in the verse's `note` (what changed and why).
- Keep verse count, verse order, and the `#` paragraph markers exactly as in `kjv/`.
- Keep `LORD` and the weighty theological words that are still living English (justified, righteous, grace, redeemed, firstborn, predestined).
- If you are not confident a KJV rendering is wrong, keep its sense and flag the verse instead of changing it.

## 3. Per-chapter outputs

For each chapter you polish or draft, write/update:
- `par/text/<slug>.json` — `{"book": "...", "chapter": N, "verses": [...]}`, one string per verse, `#` markers kept in-line as in the existing files.
- `par/review/<slug>.md` — a KJV-beside-KJV27 markdown table, same format as `par/review/proverbs-12.md` (columns `v | KJV | KJV27`, corrections noted inline in the KJV27 cell as `_(correction: ...)_`), ending with the standard "Agreement among models is evidence, not proof" line adapted to say this is an unattended Claude run.
- `par/progress.json` — update the chapter's entry: `review: "hand-polished"`, `date` = today (America/New_York), `drafters` includes `"claude (unattended)"` (append rather than replace if other drafters already produced the base text), `revised` left as-is unless you revised specific verses.
- `par/NOTES.md` — append a dated entry under a `## <date>: unattended daily polish` heading for any judgment call you made (uncertain Hebrew/Greek you flagged instead of changing, ambiguous wording, etc.).

### Gate (required)

Run `dryrun.gate(src, out)` from `par/pipeline/dryrun.py` on every chapter you touch and fix every error it raises before moving on. Quotes must balance *within each verse* — in a multi-verse speech, close the quote at the end of each verse and reopen it at the start of the next, don't leave it open across verses.

If you touch `par/pipeline/rules.py`, run `python par/pipeline/test_rules.py` and make it pass before committing.

## 4. Study notes — only where confident

For chapters you polish or draft, add study notes where you're genuinely confident (2-5 solid notes is the right range; fewer or none is fine):
- Write `par/notes/<slug>.json` (`{"chapter": "<slug>", "notes": [...]}`) and list `<slug>` in `par/notes/index.json`'s `chapters` array.
- Each note: `{"v": verse, "match": [KJV27 phrase, KJV phrase], "kind": ..., "title": ..., "text": ..., "refs": [...], "source": "..."}`.
- Kinds: `word`, `variant`, `ane`, `archaeology`, `extrabiblical`, `prophecy`, `canon`.
- `text` under 700 characters, and names its source.
- Hedge anything scholars dispute. `prophecy` notes only for what independent historical records back up.
- Never invent a source, inscription number, or quotation — if you can't name a real one, leave the note out.
- `match`: KJV27 wording first, KJV wording second.
- Run `python par/pipeline/notes_check.py` and fix every problem it reports.

## 5. Handoff and PR

- Briefly update the "State" section of `par/HANDOFF.md` (what this run polished/drafted, nothing more).
- Commit everything on `claude/kjv27-<date>`, push it, and open **one draft PR**:
  - `gh pr create --draft --base main --head claude/kjv27-<date> --title "KJV27 polish: <chapters> (<date>)" --body "..."`
  - Body: which chapters, what was corrected and why (summarize, don't repeat the whole review table), which verses were flagged for review instead of changed, which study notes were added, what was tested (the gate, `notes_check.py`, `test_rules.py` if touched) and what was not (nothing could be viewed in the live app — this job never runs the frontend).
- If `gh pr create` fails for any reason, do not fall back to a REST workaround or a GraphQL mutation — just push the branch, print the branch name clearly in the step log, and exit non-zero so the run shows as failed and a human can open the PR by hand.
