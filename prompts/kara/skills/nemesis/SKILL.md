# ARSENAL-02 Nemesis

## Description
Nemesis is an evidence enrichment pipeline accessible via a REST API on port 7443. It uses basic authentication and a self-signed TLS certificate.

## Interaction

### Environment
The following environment variables must be set to authenticate:
- `NEMESIS_USER`
- `NEMESIS_PASSWORD`

### Verify
Perform a health check to verify the service is online. The `--insecure` flag is required due to the self-signed certificate.
```bash
curl --insecure -u "${NEMESIS_USER}:${NEMESIS_PASSWORD}" https://localhost:7443/api/v1/health
```

### Run (Enrichment)
Submit an indicator for enrichment.
```bash
# Example: Enrich an IP address
curl --insecure -u "${NEMESIS_USER}:${NEMESIS_PASSWORD}" -X POST -H "Content-Type: application/json" -d '{"type": "ip", "value": "8.8.8.8"}' https://localhost:7443/api/v1/enrich
```
