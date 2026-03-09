# Kara Vanguard - LESSONS

## Purpose
Track repeat breakdowns in emulation and detection validation.

## Format
- Date
- Scenario
- Gap observed
- Mitigation and verification

---

## 2026-03-03 — ARSENAL Container OOM Events

**Scenario:** Long-running ARSENAL service containers (LitterBox, Nemesis) occasionally hit memory limits and OOM-kill, causing silent service degradation. Dashboard shows container as "running" but health probes fail.

**Gap:** No proactive memory threshold alerting. Container restarts are silent — no notification to Maleick.

**Mitigation:** Monitor via `docker stats` in docker.stats.snapshot telemetry. DockerResourcePanel now shows per-container memory usage. Alert threshold: warn at 80% mem_limit, critical at 90%.

**Verification:** DockerResourcePanel memory column shows `{used} / {limit}` — visual confirmation in dashboard.

---

## 2026-03-03 — RedWardenLite Config Reload Requires Restart

**Scenario:** Maleick edited `portainer/redwardenlite/config/config.yaml` but changes didn't take effect. RedWardenLite has no hot-reload capability.

**Gap:** No documentation or automated workflow for config changes. It was assumed live config updates would apply.

**Mitigation:** `run_redwardenlite.sh` provides `restart` action gated behind `VANGUARD_ALLOW_RESTART=1`. Config change workflow: edit YAML on host → run `restart` action → verify with `status` action. Documented in `personas/kara/skills/redwardenlite/SKILL.md`.

**Verification:** `run_redwardenlite.sh status` returns HTTP non-000 after restart.

---

## 2026-03-03 — Build Container One-Shot Pattern

**Scenario:** BOF_Spawn and Beacon build containers left running after `docker compose up`, consuming resources indefinitely despite being build-only tools.

**Gap:** docker-compose.yml used default restart policy, leaving exited containers in restart loop.

**Mitigation:** All build containers use `restart: "no"` in compose and are invoked via `docker compose run --rm`. This ensures containers are removed after build completes.

**Verification:** `docker ps -a | grep build` shows no lingering build containers.

---

## 2026-03-03 — Shared Library Sourcing Convention

**Scenario:** 9 copies of `in_disallowed_runtime()` across Kara scripts caused a divergence bug in `run_cobalt_docker_api.sh` (hardcoded `rg` dependency at line 64).

**Gap:** No shared library. Each script copied common functions independently, leading to drift.

**Mitigation:** Extracted canonical implementations to `scripts/kara/lib/kara_common.sh` (commit d980fb2). All 8 scripts now source the shared library. Double-source guard prevents multiple loads.

**Verification:** Run any refactored script with `--dry-run` — sources library without error.
