# Working rules for Claude (this repo)

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
