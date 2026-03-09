# Kara Vanguard — PLAYBOOK

## Channel Lock

Kara only operates in the **Purple channel**. All engagement commands, tool invocations, audit queries, and status checks must originate from and return results to the Purple channel. Cross-channel actions are prohibited.

---

## Purple Team Engagement Philosophy

Purple team engagements at VanguardForge are controlled, repeatable simulations with measurable detection outcomes. Each engagement follows the same lifecycle:

1. **Objective** — define adversary pattern and success criteria
2. **Build** — compile payloads (BOF/beacon) using ARSENAL build pipeline
3. **Redirect** — configure C2 traffic routing via RedWardenLite
4. **Deliver** — submit artifacts to LitterBox for pre-flight analysis
5. **Enrich** — feed artifacts into Nemesis for enrichment and pattern extraction
6. **Detect** — capture defensive telemetry; document detection gaps
7. **Harden** — feed lessons into detection rules and retrospective

---

## Engagement Workflow: Step-by-Step

### Step 1: Select Objective and Adversary Pattern

Define the adversary technique to simulate. Examples:
- Beacon initial access via HTTP redirect
- BOF injection into lsass via Cobalt Strike
- Shellcode loader bypassing AV static scan

Document the objective in a Purple channel message before starting tool invocations.

### Step 2: Build Payload (ARSENAL-04 or ARSENAL-05)

**For BOF compilation (ARSENAL-04):**
```
Run: bash /opt/VanguardForge/scripts/kara/build_bof_spawn.sh \
  --src /opt/VanguardForge/portainer/arsenal-bof-build/src \
  --out /opt/VanguardForge/portainer/arsenal-bof-build/output \
  --name <engagement_name>_bof
```
Expected: `<engagement_name>_bof.o` produced in output/. Audit event logged to `validate/output/kara_cobalt_api_audit.ndjson`.

**For beacon compilation (ARSENAL-05):**
```
Run: bash /opt/VanguardForge/scripts/kara/build_beacons.sh \
  --src /opt/VanguardForge/portainer/arsenal-beacon-build/src \
  --out /opt/VanguardForge/portainer/arsenal-beacon-build/output \
  --name <engagement_name>_beacon
```
Expected: DLL or EXE artifact in output/. Auto-detects Makefile vs cmake.

**Dry-run (safe planning mode — no containers invoked):**
```
Run: bash /opt/VanguardForge/scripts/kara/build_bof_spawn.sh --dry-run --name <name>
Run: bash /opt/VanguardForge/scripts/kara/build_beacons.sh --dry-run --name <name>
```

### Step 3: Configure C2 Traffic Routing (ARSENAL-03)

RedWardenLite is a config-driven C2 traffic redirector. It has NO management API — config changes require host-side file edit + container restart.

**Show current redirector config:**
```
Run: bash /opt/VanguardForge/scripts/kara/run_redwardenlite.sh --action show-config
```

**Validate config syntax:**
```
Run: bash /opt/VanguardForge/scripts/kara/run_redwardenlite.sh --action validate-config
```

**Apply config change** (Maleick edits `/opt/VanguardForge/portainer/redwardenlite/config/config.yaml` on docker01 host first, then):
```
Run: VANGUARD_ALLOW_RESTART=1 bash /opt/VanguardForge/scripts/kara/run_redwardenlite.sh --action restart
```

**Check proxy status:**
```
Run: bash /opt/VanguardForge/scripts/kara/run_redwardenlite.sh --action status
```

Note: Proxy reachability at port 8080 — any HTTP response (including 3xx/4xx redirect responses) is a valid proxy PASS.

### Step 4: Pre-Flight Static Analysis via LitterBox (ARSENAL-01)

Before deploying a payload against a target, submit it to LitterBox for static analysis.

**Verify LitterBox is up:**
```
Run: bash /opt/VanguardForge/scripts/kara/verify_litterbox.sh
```

**Submit payload for analysis:**
```
Run: bash /opt/VanguardForge/scripts/kara/run_litterbox.sh \
  --method POST \
  --path /api/samples \
  --file /opt/VanguardForge/portainer/arsenal-bof-build/output/<engagement_name>_bof.o
```
Expected: JSON response with scan UUID. Note the UUID.

**Retrieve analysis results:**
```
Run: bash /opt/VanguardForge/scripts/kara/run_litterbox.sh \
  --method GET \
  --path /api/scans/<uuid>
```
Audit log: `validate/output/kara_litterbox_audit.ndjson`

Decision gate: If LitterBox flags the artifact as high-confidence malware with expected signatures → proceed. If unexpected signatures found → investigate before deployment.

### Step 5: Enrich Artifacts via Nemesis (ARSENAL-02)

Submit the compiled artifact to Nemesis for metadata enrichment, pattern tagging, and long-term storage.

**Verify Nemesis is up:**
```
Run: bash /opt/VanguardForge/scripts/kara/verify_nemesis.sh
```
(Requires NEMESIS_HTTP_USERNAME and NEMESIS_HTTP_PASSWORD in Kara's env.)

**Submit for enrichment:**
```
Run: bash /opt/VanguardForge/scripts/kara/run_nemesis.sh \
  --method POST \
  --path /api/files \
  --file /opt/VanguardForge/portainer/arsenal-bof-build/output/<engagement_name>_bof.o \
  --metadata '{"agent_id":"vanguardclaw","project":"<engagement_name>","timestamp":"<ISO8601>","expiration":"<ISO8601+1yr>","path":"/engagements/<engagement_name>"}'
```
Expected: HTTP 201 with submission ID.

**Query enriched data:**
```
Run: bash /opt/VanguardForge/scripts/kara/run_nemesis.sh \
  --method GET \
  --path /api/v1/data
```
Audit log: `validate/output/kara_nemesis_audit.ndjson`

### Step 6: Execute Controlled Simulation

With payload built (Step 2), traffic routing configured (Step 3), and artifact analyzed (Steps 4–5), execute the simulation against the controlled target. This step is Maleick-directed — not automated by Kara.

Document the simulation start time and target in the Purple channel.

### Step 7: Capture Telemetry and Defensive Outcomes

After simulation:
1. Collect SIEM/EDR alerts triggered during the engagement
2. Compare against expected detection rules
3. Document any detection gaps (techniques that fired without alerting)

### Step 8: Feed Lessons Into Detection Hardening

For each detection gap identified:
1. Document the specific technique and evasion method
2. Draft a detection rule hypothesis
3. Submit to detection engineering for rule authoring
4. Re-run engagement after rule deployment to confirm coverage

---

## ARSENAL Quick Reference

| ARSENAL | Tool | Kara Command | Purpose |
|---------|------|-------------|---------|
| 01 | LitterBox | `run_litterbox.sh --method POST --path /api/samples --file <path>` | Pre-flight static analysis |
| 02 | Nemesis | `run_nemesis.sh --method POST --path /api/files --file <path> --metadata '{...}'` | Artifact enrichment |
| 03 | RedWardenLite | `run_redwardenlite.sh --action <show-config\|validate-config\|status\|restart>` | C2 traffic routing |
| 04 | BOF_Spawn | `build_bof_spawn.sh --src <dir> --out <dir> --name <name>` | BOF compilation |
| 05 | CS-Beacons | `build_beacons.sh --src <dir> --out <dir> --name <name>` | Beacon compilation |

All scripts: `bash /opt/VanguardForge/scripts/kara/<script_name>.sh`
All scripts support: `--dry-run` (short-circuit, audit only, no real action)

---

## Dry-Run Mode

All ARSENAL scripts support `--dry-run`. Use this for:
- Planning engagement steps without invoking containers or APIs
- Testing Slack command syntax before live engagement
- Demonstrating workflow to stakeholders

Dry-run always logs an audit event to the NDJSON audit file and exits 0.

---

## Audit Trail

All Kara tool invocations write NDJSON audit events. Verify the trail after each engagement:

```
Run: ls -la /opt/VanguardForge/validate/output/kara_*_audit.ndjson
Run: tail -5 /opt/VanguardForge/validate/output/kara_litterbox_audit.ndjson
Run: tail -5 /opt/VanguardForge/validate/output/kara_nemesis_audit.ndjson
```

---

## Escalation

Escalate confirmed control failures with:
- Reproducible steps (exact commands used)
- Timestamp of execution
- Expected vs actual output
- Relevant audit log entries (from `kara_*_audit.ndjson`)

High-risk actions (any action requiring `!unblock high`) require explicit confirmation from Maleick before execution. Reset on container restart.

---

## Tool Verification (Pre-Engagement Health Check)

Run before each engagement to confirm all tools are operational:

```
Run: bash /opt/VanguardForge/scripts/kara/verify_litterbox.sh
Run: bash /opt/VanguardForge/scripts/kara/verify_nemesis.sh
Run: bash /opt/VanguardForge/scripts/kara/verify_redwardenlite.sh
Run: bash /opt/VanguardForge/scripts/kara/verify_cobalt_docker_api.sh
```

Build containers (ARSENAL-04, ARSENAL-05) have no persistent health check — use `--dry-run` for pre-flight:
```
Run: bash /opt/VanguardForge/scripts/kara/build_bof_spawn.sh --dry-run --name preflight_check
Run: bash /opt/VanguardForge/scripts/kara/build_beacons.sh --dry-run --name preflight_check
```

---
*Kara Vanguard PLAYBOOK — v1.4 Red Team Arsenal Expansion*
*Updated: 2026-03-01 — Phase 20 full purple team workflow*
