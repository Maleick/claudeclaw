# ARSENAL-03 RedWardenLite

## Description
RedWardenLite is a C2 HTTP redirector that listens on port 8080. It operates as a proxy-only service with no management API. Configuration is managed via a host-side YAML file.

## Source
Container: `vf-arsenal-redwardenlite` on `vanguardforge-data-net`

## Setup
Deployed via Portainer stack at `portainer/redwardenlite/`. No bootstrap step required (Portainer-managed).

```bash
bash /opt/VanguardForge/scripts/kara/bootstrap_redwardenlite.sh
```

## Verify
RedWardenLite has no `/status` endpoint. Verification checks that the proxy responds with any HTTP code other than `000` (connection refused). Status codes like 3xx and 4xx are valid proxy policy responses.

```bash
bash /opt/VanguardForge/scripts/kara/verify_redwardenlite.sh --dry-run
bash /opt/VanguardForge/scripts/kara/verify_redwardenlite.sh
```

## Run
The run script provides config lifecycle management only. There is no REST API.

```bash
# Show current configuration
bash /opt/VanguardForge/scripts/kara/run_redwardenlite.sh --action show-config

# Validate configuration YAML syntax
bash /opt/VanguardForge/scripts/kara/run_redwardenlite.sh --action validate-config

# Check container status
bash /opt/VanguardForge/scripts/kara/run_redwardenlite.sh --action status

# Restart after config change (requires guard variable)
VANGUARD_ALLOW_RESTART=1 bash /opt/VanguardForge/scripts/kara/run_redwardenlite.sh --action restart
```

## Configuration Changes
1. Edit the config file on the host: `portainer/redwardenlite/config/config.yaml`
2. Validate: `run_redwardenlite.sh --action validate-config`
3. Apply: `VANGUARD_ALLOW_RESTART=1 run_redwardenlite.sh --action restart`

## Troubleshooting
- **Container not starting**: Check `docker logs vf-arsenal-redwardenlite` for YAML parse errors.
- **Verify returns 000**: Container is not running or port 8080 is not bound. Check `docker ps`.
- **Restart refused**: Ensure `VANGUARD_ALLOW_RESTART=1` is set in the environment.
