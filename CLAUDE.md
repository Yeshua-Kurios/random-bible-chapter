# Working rules for Claude (this repo)

## Repo Rules doc

Also check the shared Repo Rules doc (Drive, PWAs folder) at session start if it hasn't been
checked in the last 24h — enforced by `.claude/hooks/session-start-repo-rules.sh`:
https://docs.google.com/document/d/1jrT4eRP6ZEYjZxcc9kvkOfrgfiCJFl6wkbZ7LivLMIU/edit

## Resource research (models, APIs, services, tools)

Whenever a task requires researching which resource to use — an LLM model, an
API, a hosting service, a library — for a quality-vs-cost tradeoff:

1. **Always survey all realistic options across every provider — never limit
   the search to one provider or one family up front.** If the tool currently
   in place is constrained (e.g. `claude-code-action` only runs Anthropic
   models), that's a separate, later consideration — note it as a switching
   cost or integration barrier against the winning option, don't use it to
   narrow the research itself. The owner decides whether a constraint is
   worth keeping; research shouldn't decide that silently by never looking
   past it.
2. Do the research, then **spawn a subagent to audit the research's
   thoroughness** before presenting conclusions — have it check for
   unverified claims, rounded-away caveats, internally inconsistent sources,
   and anything that should be flagged as uncertain rather than stated
   plainly. Fold its findings into the answer; don't present research as
   final until that audit has run.
3. Always generate a portable prompt the user can paste into another AI
   platform to re-run or extend the same research elsewhere. Give it
   alongside the findings, not instead of them.

See `par/HANDOFF.md`, `par/STYLE.md`, and `.github/copilot-instructions.md`
for the KJV27 project's own content and workflow rules.

## Design workflow (EGM)

This repo uses Google's Elephant-Goldfish Model plugin (`egm@egm`) for
features that need design decisions before implementation:

1. `/egm-brainstorm` to stress-test the idea and produce `concepts_brief.md`.
2. `/egm-draft` to turn it into a design doc under `docs/designs/`.
3. `/egm-review` for a fresh-context, multi-stage review of the draft.
4. Human review (PR) before implementing.

Load `_agents/skills/random-bible-chapter_elephant/SKILL.md` first for
project context. Skip this workflow for a small, clear fix — use your
normal coding workflow instead. `docs/designs/SITEMAP.md` indexes approved
designs; run `/egm-drift-report` periodically to catch drift between them
and the code.

## Session cost (TokenEconomizer)

This repo also has Microsoft Research's TokenEconomizer plugin
(`tokeneconomizer@tokeneconomizer`) installed, which learns per-repo
micro-skills, prunes unused tools, and intervenes on failure loops across
sessions. It writes its own state to `.claude/settings.local.json` and
`.git/info/exclude` (both untracked — do not commit them). Run
`/tokeneconomizer:status` to check it, and `/tokeneconomizer:toolprune
refresh-catalog` once per machine (and after Claude Code updates).
