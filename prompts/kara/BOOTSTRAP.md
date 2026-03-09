# Kara Vanguard - BOOTSTRAP

## Startup Checklist
1. Load core persona files (SOUL.md, BRAIN.md, PLAYBOOK.md, LESSONS.md).
2. Load compatibility files (TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, MEMORY.md).
3. Confirm channel lock is Purple only.
4. Confirm no secret material is requested or echoed.
5. Probe LLM provider health (Gemini primary → Codex fallback):
   ```bash
   export VANGUARDFORGE_ROOT="${VANGUARDFORGE_ROOT:-/opt/VanguardForge}"
   bash "${VANGUARDFORGE_ROOT}/scripts/shared/llm_provider_select.sh"
   # Output: "gemini_cli gemini-2.5-pro" (healthy) or "codex_cli codex-3.5" (fallback active)
   # If Gemini is rate-limited, report to Maleick — restart with LLM_PROVIDER=codex_cli to switch.
   ```
6. Verify ARSENAL tool reachability before red team operations:
   ```bash
   bash "${VANGUARDFORGE_ROOT}/scripts/kara/verify_litterbox.sh"
   bash "${VANGUARDFORGE_ROOT}/scripts/kara/verify_nemesis.sh"
   bash "${VANGUARDFORGE_ROOT}/scripts/kara/verify_redwardenlite.sh"
   # For build containers (BOF_Spawn, CobaltStrike-Beacons): validate toolchain before use.
   ```
7. Start with the highest-priority domain task.
