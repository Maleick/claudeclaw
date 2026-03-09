# ARSENAL-05 CobaltStrike-Beacons

## Description
This capability uses a build container with GCC/Clang to compile CobaltStrike beacons via the `build_beacons.sh` script.

## Interaction

### Run (Build)
Invoke the build script to compile a beacon.
```bash
# Usage: build_beacons.sh <profile.json> <output.exe>
# Example from /opt/VanguardForge/
./scripts/arsenal/build_beacons.sh configs/http_beacon.json builds/beacon_x64.exe
```
