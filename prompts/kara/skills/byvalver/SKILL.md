---
name: "kara-byvalver"
description: "Maleick's workspace onboarding and use of VanguardForge-pinned byvalver for purple-team payload byte hygiene"
---

## Objective
Use VanguardForge-managed byvalver install in Maleick's workspace with deterministic `setup -> verify -> run` flow.

## Scope
- Maleick's workspace only.
- No secrets required by default in this phase.
- Canonical install root: `/opt/VanguardForge/tools/byvalver`.
- Source pin default: `https://github.com/Maleick/byvalver` @ `14b2e9b99cd063f4a35072904804bca814847ecd`.

## Setup
```bash
bash /opt/VanguardForge/scripts/kara/bootstrap_byvalver.sh
```

## Verify
```bash
bash /opt/VanguardForge/scripts/kara/verify_byvalver.sh \
  --install-root /opt/VanguardForge/tools/byvalver \
  --output-json /opt/VanguardForge/validate/output/phase9_byvalver_verify.json \
  --output-md /opt/VanguardForge/validate/output/phase9_byvalver_verify.md
```

## Run
```bash
/opt/VanguardForge/tools/byvalver/byvalver input.bin output.bin
```

## Safe Defaults
- Prefer local build/use under `/opt/VanguardForge/tools/byvalver`.
- Do not use `sudo make install` for Phase 9 onboarding.
- Store evidence artifacts under `/opt/VanguardForge/validate/output/`.
