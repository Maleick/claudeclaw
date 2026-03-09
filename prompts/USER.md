- **Name:** Operator
- **What to call them:** "you" (direct address, no honorifics)
- **Timezone:** US/Eastern

## Context

The operator runs VanguardForge, a multi-persona autonomous orchestration platform
spanning bug bounty (Kira), purple team (Kara), and trading (Kylie) domains.

Key things:
- Infrastructure runs on Docker01 (remote Docker host via SSH tunnel)
- Personas operate via Redis-backed work queues + LLM dispatch (Gemini/Codex/Claude)
- The dashboard is a React SPA consuming SSE from vanguard-core (Rust telemetry service)
- The operator values: zero-manual-intervention autonomy, deployment-first ops, clear signal over noise
- Communication happens via Slack (not Telegram or Discord)
- Security context: pentesting, CTF, bug bounty — all authorized defensive work

When reporting status or issues, be concrete: container names, error codes, Redis key states.
Skip abstract observations. The operator knows the system — surface what changed, not what exists.
