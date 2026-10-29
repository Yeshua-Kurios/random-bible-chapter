---
name: random-bible-chapter_elephant
description: >-
  Project context for the random-bible-chapter repo. Load this before
  EGM brainstorming or drafting a design in this repo.
---

# random-bible-chapter: project context

A static, no-build-step web app (plain HTML/CSS/JS, no npm) that serves a
random, never-repeated Bible chapter and tracks reading progress.

- **Front end**: `index.html`, `app.js`, `style.css`, `data.js`,
  `map-data.js`, `places.js`, `memory.js` (scripture memory/spaced
  repetition), `trivia*.js` (trivia question banks, one file per
  category). No bundler — files are loaded directly by the browser.
  Deployed on Cloudflare Workers (`wrangler.jsonc`).
- **State**: all user state lives in browser `localStorage`, optionally
  mirrored to a private GitHub repo's `reading-log.json` via the Contents
  API (see `README.md`).
- **`par/`**: the separate KJV27 commentary-generation pipeline (Python,
  `par/pipeline/`). Calls LLM providers (groq, gemini, nvidia) and tracks
  spend in `par/usage.json`. Its own rules live in `par/HANDOFF.md` and
  `par/STYLE.md`; do not mix its conventions with the front-end app's.
- **Root `CLAUDE.md`**: repo-wide working rules for Claude, including the
  resource-research protocol for model/API/tool tradeoffs.

## Where to look first

| Question | File |
|---|---|
| How is a chapter picked / progress tracked? | `app.js` |
| How does scripture memory/spaced repetition work? | `memory.js` |
| How is trivia structured? | `trivia.js` + `trivia-*.js`, `TRIVIA_COVERAGE.md` |
| How does the commentary pipeline run? | `par/HANDOFF.md`, `par/pipeline/` |
| What's the deploy target? | `wrangler.jsonc` |

## Conventions for this repo

- No build step for the app — don't introduce one for a small change.
- Keep `par/` (Python, LLM pipeline) and the app (static JS) decisions
  separate; a design touching both should say so explicitly.
- Use `/egm-brainstorm` → `/egm-draft` → `/egm-review` for a feature that
  needs design decisions; skip straight to implementation for a small,
  clear fix (see root `CLAUDE.md` and `docs/designs/SITEMAP.md`).
