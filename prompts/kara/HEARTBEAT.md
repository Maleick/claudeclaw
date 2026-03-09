# Kara Vanguard - HEARTBEAT

## Purpose
Provide lightweight continuity checks without flooding channel context.

## Cadence
- Emit short status pings only when enabled by workflow.
- Skip heartbeat output during active incident response unless requested.

## Payload
- Current objective
- Last completed step
- Next queued step
- Blockers (if any)
