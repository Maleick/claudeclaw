# Outflank OST — Kara Skill

## Description
Outflank Security Toolkit (OST) is a commercial red team toolkit hosted at the
Outflank SaaS portal. This skill enables Kara to autonomously navigate the OST portal
and generate payload artifacts after a one-time Maleick session seed.

Automation is performed via Chrome DevTools MCP (`chrome-devtools-mcp@0.18.1`), using
the Kara-dedicated Chrome profile at `/opt/VanguardForge/.local/chrome-devtools-mcp/kara`.
The portal requires an authenticated session; Kara uses pre-seeded cookies rather than
storing raw credentials.

**Portal URL:** `https://tas1039.us.outflank.platform.fortra.com/#`
**Artifact output:** `validate/output/kara_ost_<timestamp>.zip`
**Audit log:** `validate/output/kara_ost_audit.ndjson`

---

## Prerequisites

1. Chrome DevTools MCP server dependencies installed:
   - `npx` available in PATH (Node.js >= 18)
   - `chrome-devtools-mcp@0.18.1` resolvable via npx
   - Chromium or Google Chrome installed (used headlessly by the MCP server)
2. Kara profile directory exists:
   ```
   /opt/VanguardForge/.local/chrome-devtools-mcp/kara/
   ```
3. **One-time Maleick session seed performed** (see "Session Seeding" section below).
   Without a seeded session, headless automation will reach the login page and stop.

---

## Bootstrap

Bootstrap is a no-op for OST — there is no service to deploy or package to install.
The Chrome DevTools MCP is invoked on-demand via npx.

Run the session seed procedure (Maleick one-time step) instead:

```bash
bash /opt/VanguardForge/scripts/mcp/chrome_devtools_kara.sh --session-seed
```

Bootstrap audit event: `bootstrap_skipped` (logged automatically by run_ost_payload.sh
during first dry-run invocation if bootstrap step is not applicable).

---

## Session Seeding (Maleick One-Time Step)

**Purpose:** Persist an authenticated OST session to the Kara Chrome profile so that
subsequent headless automation can navigate the portal without re-authenticating.

**When to run:** Once after initial setup, and again whenever the OST session expires
(typically after 30 days of inactivity or explicit logout). The `verify_ost.sh` script
detects expired/missing sessions via the absence of session cookies.

**Procedure:**

1. Ensure a display is available (local GUI session, VNC, or X11 forwarding):
   ```bash
   echo $DISPLAY   # Must be non-empty on Linux
   ```

2. Launch Chrome in headed mode with the Kara profile:
   ```bash
   bash /opt/VanguardForge/scripts/mcp/chrome_devtools_kara.sh --session-seed
   ```
   Chrome opens visibly with the Kara profile directory loaded.

3. In the opened Chrome window:
   - Navigate to `https://tas1039.us.outflank.platform.fortra.com/#`
   - Log in with Maleick's OST credentials (SSO or username/password as provisioned)
   - Verify you reach the OST dashboard (toolkit list visible)
   - Close the Chrome window

4. Verify the session was persisted:
   ```bash
   bash /opt/VanguardForge/scripts/kara/verify_ost.sh --dry-run
   # Expected output: status=pass
   ```

5. Run a live verify to confirm full toolchain readiness:
   ```bash
   bash /opt/VanguardForge/scripts/kara/verify_ost.sh
   # Expected: status=pass, session check=ok
   ```

**Security note:** The Kara profile directory (`/opt/VanguardForge/.local/chrome-devtools-mcp/kara/`)
contains session cookies. Treat this directory as a credential store:
- Do not commit it to git (covered by .gitignore)
- Restrict filesystem permissions to Maleick's user account
- Rotate by deleting the profile dir and re-running session seed if compromise is suspected

---

## Verify

Verify that the Chrome DevTools MCP toolchain is installed and a valid session exists
in the Kara profile.

```bash
bash /opt/VanguardForge/scripts/kara/verify_ost.sh
```

**PASS criteria:**
- `npx` present in PATH
- `chrome-devtools-mcp@0.18.1` resolves via npx (invocation with `--help` exits 0)
- Kara profile dir exists at `/opt/VanguardForge/.local/chrome-devtools-mcp/kara/`
- Session indicators present in profile dir:
  - `Default/Cookies` file, OR
  - `Default/Local Storage/` directory, OR
  - `Default/IndexedDB/` directory

**FAIL criteria and remediation:**
- `config`: profile dir missing -> run `mkdir -p /opt/VanguardForge/.local/chrome-devtools-mcp/kara`
- `toolchain`: npx or chrome-devtools-mcp not available -> install Node.js >= 18
- `session`: no session indicators -> run session seeding procedure above

**Dry-run mode** (skips toolchain invocation and session check):
```bash
bash /opt/VanguardForge/scripts/kara/verify_ost.sh --dry-run
```

---

## Run — Payload Generation Workflow

### Synopsis

```bash
bash /opt/VanguardForge/scripts/kara/run_ost_payload.sh --template <template_name> [--dry-run]
```

### Arguments

| Flag | Required | Description |
|------|----------|-------------|
| `--template <name>` | Yes (live mode) | OST payload template name to select in the portal |
| `--dry-run` | No | Log audit event and exit 0 without making any CDP calls |
| `--output-dir <path>` | No | Override artifact output directory (default: `validate/output/`) |

### Automation Workflow (Headless CDP Sequence)

The `run_ost_payload.sh` script orchestrates the following steps via Chrome DevTools MCP:

1. **Launch MCP server** — invoke `chrome_devtools_kara.sh` (headless, no --session-seed)
   as a background process; wait for the MCP server to signal readiness on its IPC socket.

2. **Open portal tab** — send CDP `Target.createTarget` with url=`https://tas1039.us.outflank.platform.fortra.com/#`

3. **Wait for authentication gate** — poll `Runtime.evaluate` to check for the presence
   of the dashboard element (CSS selector: `.toolkit-list` or `[data-testid="dashboard"]`).
   If the login form is detected instead, emit a `session_expired` audit event and exit 1
   with message: "OST session expired — run session seeding procedure".

4. **Navigate to template** — use `Input.dispatchMouseEvent` and `Runtime.evaluate` to
   locate and click the template matching `--template <name>`. Template matching is
   case-insensitive substring match against the visible template name text.

5. **Initiate payload generation** — click the "Generate" or "Build" button associated
   with the selected template. Poll for the download prompt or download completion event.

6. **Capture artifact** — intercept `Page.downloadProgress` events to detect completion.
   Move the downloaded file from Chrome's download dir to:
   `validate/output/kara_ost_<timestamp>.zip`

7. **Cleanup** — close the target tab; shut down the MCP server; log `complete` audit event.

### Error Handling

| Condition | Audit Event | Exit Code |
|-----------|-------------|-----------|
| Slack runtime context detected | `disallowed_runtime` | 1 |
| --template not provided | `arg_missing` | 1 |
| MCP server fails to start | `mcp_start_failed` | 1 |
| Session expired (login form detected) | `session_expired` | 1 |
| Template not found in portal | `template_not_found` | 1 |
| Download timeout (>120s) | `download_timeout` | 1 |
| Successful dry-run | `dry_run_ok` | 0 |
| Successful payload generation | `complete` | 0 |

### Example Invocations

```bash
# Dry-run (no Chrome invocation, exits 0)
bash /opt/VanguardForge/scripts/kara/run_ost_payload.sh \
  --dry-run \
  --template "Cobalt Strike Shellcode"

# Live: generate payload for a named template
bash /opt/VanguardForge/scripts/kara/run_ost_payload.sh \
  --template "Cobalt Strike Shellcode"

# Live: custom output directory
bash /opt/VanguardForge/scripts/kara/run_ost_payload.sh \
  --template "Cobalt Strike Shellcode" \
  --output-dir /tmp/ost_artifacts
```

---

## Chrome DevTools MCP Usage Patterns

The following MCP tool calls are the primary primitives used by `run_ost_payload.sh`.
These are invoked via the `chrome-devtools-mcp@0.18.1` MCP server using the standard
MCP JSON-RPC protocol.

### Navigate to URL

```json
{
  "method": "Page.navigate",
  "params": { "url": "https://tas1039.us.outflank.platform.fortra.com/#" }
}
```

### Wait for Element (Poll Pattern)

```json
{
  "method": "Runtime.evaluate",
  "params": {
    "expression": "document.querySelector('.toolkit-list') !== null",
    "returnByValue": true
  }
}
```

Poll every 500ms, timeout 30s. Emit audit event and exit 1 on timeout.

### Click Element by Selector

```json
{
  "method": "Runtime.evaluate",
  "params": {
    "expression": "document.querySelector('[data-template-name*=\"Cobalt Strike Shellcode\"]').click()",
    "returnByValue": false
  }
}
```

### Intercept Download

Configure Chrome download behavior before navigation:

```json
{
  "method": "Page.setDownloadBehavior",
  "params": {
    "behavior": "allow",
    "downloadPath": "/tmp/kara_ost_download"
  }
}
```

Then poll `Page.downloadProgress` until `state=completed`.

---

## Audit Log Reference

All events appended (NDJSON) to `validate/output/kara_ost_audit.ndjson`.

| Event | Description |
|-------|-------------|
| `start` | run_ost_payload.sh invoked |
| `dry_run_ok` | --dry-run completed successfully |
| `disallowed_runtime` | Slack runtime context detected; aborted |
| `arg_missing` | Required argument not provided |
| `mcp_start_failed` | chrome-devtools-mcp server did not start |
| `session_expired` | Login form detected instead of dashboard |
| `template_not_found` | Named template not visible in portal |
| `download_timeout` | Payload download did not complete within 120s |
| `complete` | Payload artifact saved to validate/output/ |
| `verify_pass` | verify_ost.sh returned PASS |
| `verify_fail` | verify_ost.sh returned FAIL |
| `bootstrap_skipped` | Bootstrap is a no-op; logged on first dry-run |

---

## Related Files

| File | Purpose |
|------|---------|
| `scripts/mcp/chrome_devtools_kara.sh` | Chrome DevTools MCP launcher (headless + --session-seed modes) |
| `scripts/kara/run_ost_payload.sh` | Main Kara invocation script for payload generation |
| `scripts/kara/verify_ost.sh` | Toolchain + session health check |
| `personas/kara/TOOLS.md` | Kara tool registry (OST entry in Plan 27-03) |
| `runtime/vanguardclaw/config/autonomy_policy.json` | OST scripts in medium_risk_commands (Plan 27-03) |
| `validate/output/kara_ost_audit.ndjson` | NDJSON audit log |
| `/opt/VanguardForge/.local/chrome-devtools-mcp/kara/` | Kara Chrome profile (session storage) |
