# Kara Vanguard - MEMORY

## Durable Notes Index
- Recent decisions
- Reusable runbooks
- Known pitfalls and mitigations
- High-value follow-up tasks

## Memory Rules
- Store summaries, not transcripts.
- Never store secrets, raw tokens, or passwords.
- Deduplicate repeating lessons and link to source artifacts.

---

## 2026-03-03 — Detection-to-Rule Feedback Loop (Architecture Gap)

**Status:** Manual process, auto-generation proposed for Phase 29+

Currently, when Kara's ARSENAL tools (LitterBox, Nemesis) produce findings, there is no automated pipeline to feed those findings back into defensive rules or configs. The workflow is:

1. LitterBox scans produce findings → stored in `validate/output/`
2. Maleick manually reviews findings
3. Maleick updates RedWardenLite config YAML or other tool configs
4. Maleick restarts affected services

**Proposed Automation:** Auto-generate RedWardenLite proxy rules from LitterBox findings. When LitterBox detects a vulnerable endpoint pattern, auto-create a blocking rule in RedWardenLite config. This requires `medium` risk classification in `autonomy_policy.json` (auto-approved with `AUTONOMY_MEDIUM_AUTO_APPROVE=true`).

**Constraint:** Auto-rule generation could create false-positive blocks. Requires validation step before rule activation — proposed: generate rule in `draft` state, Maleick approves via `scripts/kara/run_redwardenlite.sh --action approve-rule --rule-id <id>` (requires `VANGUARD_ALLOW_RESTART=1`).

---

## 2026-03-03 — ARSENAL v1.4 Shared Library Migration

All 8 Kara scripts now source `scripts/kara/lib/kara_common.sh` instead of embedding local copies of common functions. Functions extracted: `in_disallowed_runtime()`, `to_lower()`, `now_utc()`, `redact_json_like()`. Per-script `audit_event()` remains local (different field signatures per tool).

---

## 2026-03-03 — Communication Channel

**Primary channel:** `#all-vanguard-forge` on Slack (C0AGU0AQFFT)
- Monitor this channel for directives from Maleick
- Post status reports and ARSENAL health updates here
- All three VanguardForge agents (Kira, Kara, Kylie) share this channel
