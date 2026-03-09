# ARSENAL-01 LitterBox

## Description
LitterBox is a self-hosted sandbox for malware analysis. It provides a REST API and a web interface to submit files and review detection and static analysis results. The default API port is 1337.

## Source
- `https://github.com/BlackSnufkin/LitterBox`

## Interaction

### Setup
The service is deployed via Docker.
```bash
git clone https://github.com/BlackSnufkin/LitterBox.git /opt/VanguardForge/tools/LitterBox
cd /opt/VanguardForge/tools/LitterBox
docker-compose up -d
```

### Verify
Perform a health check to verify the service is online.
```bash
# Expected response: {"status": "ok"}
curl http://localhost:1337/health
```

### Run (File Submission)
Submit a file for analysis using a POST request. The API returns a JSON object containing the analysis results.
```bash
# Usage: curl -X POST -F "file=@<file_path>" http://localhost:1337/analyze
# Example:
curl -X POST -F "file=@/path/to/payload.exe" http://localhost:1337/analyze
```

### Python Client (GrumpyCats)
The GrumpyCats python client can also be used for interaction.
```bash
# Install client
pip install -r /opt/VanguardForge/tools/LitterBox/client/requirements.txt

# Usage Example:
python3 /opt/VanguardForge/tools/LitterBox/client/grumpy.py /path/to/payload.exe
```
