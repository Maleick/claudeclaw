# Cobalt-Docker API

## Description
A REST API wrapper for Cobalt Strike (forked by Maleick), used to automate C2 operations, including payload generation and Team Server orchestration. Interaction is performed via the audited wrapper script `run_cobalt_docker_api.sh`.

## Environment
- `COBALT_DOCKER_API_URL`: The URL of the Cobalt-Docker API service.
- `COBALT_DOCKER_API_TOKEN`: The authentication token for the API.
- `COBALT_DOCKER_TLS_VERIFY`: (Optional) Set to `false` to disable TLS certificate verification.

## Interaction

### Setup
```bash
bash /opt/VanguardForge/scripts/kara/bootstrap_cobalt_docker_api.sh
```

### Verify
Verify API connectivity by listing available listeners.
```bash
bash /opt/VanguardForge/scripts/kara/run_cobalt_docker_api.sh --method GET --path /api/v1/listeners
```

### Run (Generate Payload)
Generate raw shellcode for a specified listener. The output is the raw binary payload.
```bash
# Usage: run_cobalt_docker_api.sh --method GET --path /api/v1/listeners/<LISTENER_NAME>/stageless-payload?arch=<ARCH>&format=raw
# Example: Generate 64-bit raw shellcode for 'http_beacon' listener
bash /opt/VanguardForge/scripts/kara/run_cobalt_docker_api.sh --method GET --path "/api/v1/listeners/http_beacon/stageless-payload?arch=x64&format=raw" > beacon_x64.bin
```

### Run (List Beacons)
List active beacons.
```bash
bash /opt/VanguardForge/scripts/kara/run_cobalt_docker_api.sh --method GET --path /api/v1/beacons
```

### Audit Log
All interactions are logged to /opt/VanguardForge/validate/output/kara_cobalt_api_audit.ndjson.
