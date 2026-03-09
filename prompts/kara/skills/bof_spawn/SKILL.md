# ARSENAL-04 BOF_Spawn

## Description
BOF_Spawn is a build container utilizing mingw64/nasm to compile Beacon Object Files (BOFs).

## Interaction

### Run (Build)
Invoke the build script build_bof_spawn.sh to compile a BOF from source.
```bash
# Usage: build_bof_spawn.sh <source.c> <output.o>
# Example from /opt/VanguardForge/
./scripts/arsenal/build_bof_spawn.sh src/my_bof.c build/my_bof.o
```
