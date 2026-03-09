# Kara Vanguard - TOOLS

## Allowed Tool Classes
- Read-only repo and notes inspection.
- Structured checklists and validation scripts.
- Domain analysis tooling for Purple / Red Team.

## Guardrails
- Operate only for Purple channel tasks.
- Prefer deterministic commands and auditable outputs.
- Never reveal secrets, tokens, or raw credential material.

## Self-Modification Scope (Option A — Scoped)
Kara may modify her own operational files via autonomy commands with approval:
- **Writable**: `/app/data/notes/`, `/app/data/memory/`, `/app/tasks/`, `/app/validate/output/`
- **Writable**: pip/pip3 and npm package installation (medium-risk, requires separate approver)
- **Protected (Maleick-only)**: `/app/config/autonomy_policy.json`, `/app/personas/`, Dockerfiles, `.env`, system packages (apt/apk/yum)

Self-approval is not permitted for medium or high-risk actions. A different workspace member must approve.

## Prohibited Use
- Cross-channel actions outside Purple scope.
- Destructive actions without explicit confirmation from Maleick.
- Modifying protected owner files (autonomy_policy.json, Dockerfiles, .env).

## Phase 8 Tool Federation Policy
- Kara remains **controlled dry-run** for self-improvement in this phase.
- Use explicit dry-run mode to validate contract surfaces without production scheduling:
```bash
python3 /opt/VanguardForge/scripts/kira/run_self_improvement_cycle.py \
  --repo-root /opt/VanguardForge \
  --profile kara \
  --mode dry_run
```
- Do not promote to active scheduled mode until a follow-up phase explicitly approves it.

## Browser / DevTools MCP
- Kara isolated wrapper:
```bash
/opt/VanguardForge/scripts/mcp/chrome_devtools_kara.sh --help
```
- Runtime behavior:
  - uses chrome-devtools-mcp@0.18.1
  - runs headless by default
  - uses profile dir /opt/VanguardForge/.local/chrome-devtools-mcp/kara
  - no secrets are echoed by wrapper

## Kara Federation Onboarding (Phase 9)
- Canonical runbook:
```bash
cat /opt/VanguardForge/tasks/kara_tool_federation_runbook.md
```
- Workflow is always: setup -> verify -> run.
- Execution boundary: Maleick's workspace only (never Slack runtime containers).

### byvalver
- Setup:
```bash
bash /opt/VanguardForge/scripts/kara/bootstrap_byvalver.sh
```
- Verify:
```bash
bash /opt/VanguardForge/scripts/kara/verify_byvalver.sh --install-root /opt/VanguardForge/tools/byvalver
```
- Run:
```bash
/opt/VanguardForge/tools/byvalver/byvalver input.bin output.bin
```

### Cobalt-Docker API
- Description: REST API wrapper for Cobalt Strike C2 (forked by Maleick). This is a custom integration that includes the CobaltStrike API and Team Server forks for automated payload generation and C2 orchestration.
- Required env keys:
  - COBALT_DOCKER_API_URL
  - COBALT_DOCKER_API_TOKEN
  - COBALT_DOCKER_TLS_VERIFY (optional boolean, default true)
- Setup:
```bash
bash /opt/VanguardForge/scripts/kara/bootstrap_cobalt_docker_api.sh
```
- Verify:
```bash
bash /opt/VanguardForge/scripts/kara/run_cobalt_docker_api.sh --method GET --path /api/v1/listeners
```
- Run (Generate Payload):
```bash
# Example: Generate a raw 64-bit beacon payload
bash /opt/VanguardForge/scripts/kara/run_cobalt_docker_api.sh --method GET --path "/api/v1/listeners/http_beacon/stageless-payload?arch=x64&format=raw" > beacon_x64.bin
```
- Audit log target:
  - /opt/VanguardForge/validate/output/kara_cobalt_api_audit.ndjson

### LitterBox (ARSENAL-01)
- Description: Malware/file triage REST API sandbox.
- Setup: git clone and docker-compose up
- Verify:
```bash
curl http://localhost:1337/health
```
- Run (API):
```bash
curl -X POST -F "file=@/path/to/payload.exe" http://localhost:1337/analyze
```
- Run (Client):
```bash
python3 /opt/VanguardForge/tools/LitterBox/client/grumpy.py /path/to/payload.exe
```

### Nemesis (ARSENAL-02)
- Description: Evidence enrichment pipeline REST API on port 7443.
- Required env keys:
  - NEMESIS_USER
  - NEMESIS_PASSWORD
- Verify:
```bash
curl --insecure -u "${NEMESIS_USER}:${NEMESIS_PASSWORD}" https://localhost:7443/api/v1/health
```
- Run:
```bash
# Example: Enrich an IP
curl --insecure -u "${NEMESIS_USER}:${NEMESIS_PASSWORD}" -X POST -H "Content-Type: application/json" -d '{"type": "ip", "value": "8.8.8.8"}' https://localhost:7443/api/v1/enrich
```

### RedWardenLite (ARSENAL-03)
- Description: C2 HTTP redirector on port 8080.
- Verify:
```bash
curl http://localhost:8080/status
```
- Run: Service runs as a daemon. Configuration is via YAML file.

### BOF_Spawn (ARSENAL-04)
- Description: Build container for Beacon Object Files invoked via build_bof_spawn.sh.
- Setup:
```bash
bash /opt/VanguardForge/scripts/kara/bootstrap_bof_spawn.sh
```
- Verify:
```bash
bash /opt/VanguardForge/scripts/kara/verify_bof_spawn.sh
```
- Run:
```bash
/opt/VanguardForge/scripts/kara/build_bof_spawn.sh --src src/my_bof.c --output my_bof.o
```

### CobaltStrike-Beacons (ARSENAL-05)
- Description: Build container for CobaltStrike beacons invoked via build_beacons.sh.
- Setup:
```bash
bash /opt/VanguardForge/scripts/kara/bootstrap_beacons.sh
```
- Verify:
```bash
bash /opt/VanguardForge/scripts/kara/verify_beacons.sh
```
- Run:
```bash
/opt/VanguardForge/scripts/kara/build_beacons.sh --src configs/http_beacon/ --output beacon_x64.dll
```

### Subagent Router (v1.5)
- Description: Orchestrator-driven subagent delegation module (`subagent_router.rs`) in vanguardclaw. Routes validated findings to specialized workers (report builder, stage8 BOLA scanner) based on externalized rules in `routing_policy.json`. Not directly invoked by Kara — integrated into the orchestrator tick loop.
- Key files:
  - `runtime/vanguardclaw/src/subagent_router.rs` — routing logic, depth cap enforcement, env scrubbing
  - `runtime/vanguardclaw/config/routing_policy.json` — externalized routing rules (hot-reloadable)
- Hot-reload: `notify` filesystem watcher on `routing_policy.json`; changes applied without container restart via `Arc<RwLock<RoutingPolicy>>`
- Cross-channel notification: `KARA_CHANNEL_ID` env var enables optional Slack notification to Kara's purple channel when subagent delegation occurs
- Constraints:
  - MAX_DELEGATION_DEPTH=2 (hard-coded + DB CHECK constraint)
  - Env whitelist: H1_API_TOKEN, DATABASE_URL, SLACK_BUGBOUNTY_BOT_TOKEN only
  - COBALT_*, PORTAINER_API_TOKEN excluded from subagent env
- Kara's role: Monitor subagent lease events via `subagent_lease_log` table for audit; no direct invocation

### Outflank OST
- Description: Commercial red team payload generation toolkit (SaaS portal). Kara navigates autonomously after one-time Maleick session seeding via Chrome DevTools MCP.
- Skill: `personas/kara/skills/outflank-ost/SKILL.md`
- Required: One-time Maleick session seed (see SKILL.md "Session Seeding" section)
- Setup (one-time session seed):
```bash
bash /opt/VanguardForge/scripts/mcp/chrome_devtools_kara.sh --session-seed
```
- Verify:
```bash
bash /opt/VanguardForge/scripts/kara/verify_ost.sh
```
- Run (Generate Payload):
```bash
bash /opt/VanguardForge/scripts/kara/run_ost_payload.sh --template "Cobalt Strike Shellcode"
```
- Audit log target:
  - /opt/VanguardForge/validate/output/kara_ost_audit.ndjson
