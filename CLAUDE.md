# Working rules for Claude (this repo)

## Resource research (models, APIs, services, tools)

Whenever a task requires researching which resource to use — an LLM model, an
API, a hosting service, a library — for a quality-vs-cost tradeoff:

1. Scope the question first: confirm what's actually a free choice versus
   constrained by the system already in place (e.g. `claude-code-action` only
   runs Anthropic models, so "best LLM API" for a job using it is a
   within-Claude-family choice, not a cross-provider one).
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
