# PAR handoff (translation-only plan)

Last updated 2026-10-18.

## Project
PAR = Pastorally Affirmed Rendering. Free models translate the Bible from the Hebrew (WLC) and Greek (SBLGNT) critical texts. Other models cross-check. A person is the final reviewer.
This is NOT a KJV modernization. The modernized-KJV pilot (par/pilot-*.json, par/STYLE.md) is obsolete as a target.

## Design rules
- The drafter sees only the source text, never the KJV or any English Bible.
- Checkers compare the draft to the Hebrew/Greek.
- Deterministic gate: every source word (lemma/morphology data: OpenScriptures morphhb for Hebrew, MorphGNT for Greek) is accounted for in the output, and every output word traces to a source word.
- Sources are critical editions, not manuscript images. Models cannot reliably read codex photos.
- Free models invent lexical justifications. A person reviews before it is called a translation.
- Keep verse count and order. Write one chapter per file (a very large write was content-filtered once). Split Psalm 119.

## Open decisions (ask the owner)
1. Greek base text: critical (SBLGNT), Byzantine, or Textus Receptus.
2. Written definition of "Pastorally Affirmed" and translation principles (literalness, divine name, idioms, textual variants).
3. Hebrew OT first, then Greek NT?
4. Daily job: about 5 chapters/day (about 238 days), one fresh session per run, draft PR each day. Chapter order and run time.

## State
- Repo moved to the Yeshua-Kurios org. The old session could not push (403) or merge PR #19.
- PR #19 (par-pilot into main) has the obsolete KJV pilot and the first pipeline version. Close it or merge it from the GitHub UI.
- NOT on GitHub (lost unless copied from the old session): nine-provider par/pipeline/config.json, rewritten par/pipeline/dryrun.py, updated .github/workflows/par-dryrun.yml.
- No real translation has been produced. The one workflow run (before keys existed) passed with every model skipped.

## Pipeline design (rebuild)
- dryrun.py, standard library only:
  - Fetch Hebrew from raw.githubusercontent.com/openscriptures/morphhb/master/wlc/<Book>.xml (OSIS); parse chapter verses.
  - The drafter returns JSON {"verses":[{"n","gloss","translation"}]}.
  - Three checkers (lexical, meaning, style) each return {"verdict","issues":[{"verse","problem","suggestion"}]}.
  - Write Markdown + JSON, append to $GITHUB_STEP_SUMMARY, upload as an artifact.
  - Skip any provider whose key env var is unset. Never print keys.
  - `--list-models` mode: GET {base_url}/models per provider and print IDs.
  - Drafter fallback chain across providers. Expand {VAR} placeholders in base URLs from the environment.
- Workflow: runs on push to par-pilot (paths par/pipeline/**) and workflow_dispatch. First list-models, then the dry run (Ps 23).
- config.json providers (OpenAI-compatible; base URLs are from memory, VERIFY):
  - nvidia: https://integrate.api.nvidia.com/v1 (NVIDIA_API_KEY)
  - groq: https://api.groq.com/openai/v1 (GROQ_API_KEY)
  - cerebras: https://api.cerebras.ai/v1 (CEREBRAS_API_KEY)
  - gemini: https://generativelanguage.googleapis.com/v1beta/openai (GEMINI_API_KEY)
  - mistral: https://api.mistral.ai/v1 (MISTRAL_API_KEY)
  - workersai: https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1 (WORKERSAI_API_KEY)
  - sambanova: https://api.sambanova.ai/v1 (SAMBANOVA_API_KEY)
  - zai: https://api.z.ai/api/paas/v4 (ZAI_API_KEY)
  - scaleway: https://api.scaleway.ai/v1 (SCALEWAY_API_KEY)
- Suggested roles: drafters cerebras, groq, sambanova (fallback order). Checkers nvidia (lexical), gemini (meaning), mistral (style).
- Model IDs were guesses: fix them from the --list-models output.

## Secrets (org-level; give this repo access to each)
NVIDIA_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, WORKERSAI_API_KEY, SAMBANOVA_API_KEY, ZAI_API_KEY, SCALEWAY_API_KEY.
Still needed: CLOUDFLARE_ACCOUNT_ID (Workers AI).

## Gotchas
- Hebrew psalm numbering differs from English (titles count as verse 1). Needs a mapping beyond Ps 23.
- The deploy workflow publishes the whole repo folder: never commit keys.
- Agreement among free models is evidence, not proof. Diminishing returns likely past about 3 checkers (a guess to measure with a planted-error test set).
- Cost reference: a full pass is about 3 to 5M tokens; 5 chapters/day is roughly 10k tokens/day.

## TODO
1. Install the Claude GitHub App on the org. Rebuild the three pipeline files.
2. Add CLOUDFLARE_ACCOUNT_ID. Confirm secret access. Run the workflow. Fix URLs and model IDs.
3. Write translation principles (replace STYLE.md). Build the lemma-based gate and a planted-error test set.
4. Review the Ps 23 output against the Hebrew. Then add Greek (John 3 first).
5. Daily scheduled task with par/PROGRESS.json. App toggle in a separate PR.
