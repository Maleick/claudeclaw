/**
 * Slack bridge — Socket Mode listener + Redis consumer that receives
 * @mentions, routes messages through Claude CLI, and posts responses to Slack.
 *
 * Architecture:
 *   1. Socket Mode WebSocket ← Slack events (app_mention, message)
 *   2. Events RPUSH → Redis inbox key
 *   3. BLPOP ← Redis inbox key → Claude CLI → Slack Web API response
 *
 * If no appToken is configured, falls back to Redis-only mode
 * (useful when the Rust vanguardclaw runtime handles Socket Mode).
 *
 * Usage:  claudeclaw slack
 *
 * Requires settings:
 *   slack.botToken   — Slack Bot OAuth token (xoxb-...)
 *   slack.appToken   — Slack App-Level token (xapp-...) for Socket Mode
 *   slack.redisUrl   — Redis connection URL
 *   slack.inboxKey   — Redis queue key (e.g., "vanguardclaw:bot:inbox:aeri")
 */

import Redis from "ioredis";
import { initConfig, loadSettings } from "../config";
import { runUserMessage, ensureProjectClaudeMd, bootstrap } from "../runner";
import { sendSlackResult, postSlackMessage } from "../slack";

interface SlackInboxItem {
  type: string;
  correlation_id?: string;
  profile?: string;
  channel_id: string;
  event_ts: string;
  thread_ts: string;
  user: string;
  message: string;
  plan_mode?: boolean;
}

/** Slack Socket Mode envelope from WebSocket */
interface SocketEnvelope {
  envelope_id: string;
  type: string;            // "events_api", "slash_commands", "interactive", "hello"
  payload?: {
    event?: {
      type: string;        // "app_mention", "message"
      channel: string;
      user?: string;
      text?: string;
      ts: string;
      thread_ts?: string;
      bot_id?: string;
    };
    event_id?: string;
  };
  retry_attempt?: number;
  retry_reason?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const ENVELOPE_TYPE = {
  HELLO: "hello",
  EVENTS_API: "events_api",
} as const;

const EVENT_TYPE = {
  APP_MENTION: "app_mention",
  MESSAGE: "message",
} as const;

let running = true;

function ts() {
  return new Date().toLocaleTimeString();
}

function uuid(): string {
  return crypto.randomUUID();
}

/** Truncate a string for log preview. */
function truncate(s: string, len: number): string {
  return s.length > len ? `${s.slice(0, len)}...` : s;
}

/**
 * Strip bot mention prefix from message text.
 * Slack formats mentions as `<@U0AK33CM9RD> hello` — we strip the leading mention.
 */
function stripMention(text: string): string {
  return text.replace(/^<@[A-Z0-9]+>\s*/, "").trim();
}

/** Check if a user is authorized (empty allowlist = all authorized). */
function isAuthorized(userId: string, allowedUserIds: string[]): boolean {
  return allowedUserIds.length === 0 || allowedUserIds.includes(userId);
}

// ─── Socket Mode ────────────────────────────────────────────────────

/**
 * Connect to Slack Socket Mode and push incoming events to Redis.
 * Automatically reconnects on disconnect.
 */
async function startSocketMode(
  appToken: string,
  redis: Redis,
  inboxKey: string,
  allowedUserIds: string[],
): Promise<void> {
  async function connect(): Promise<WebSocket> {
    // Request a WebSocket URL from Slack
    const res = await fetch("https://slack.com/api/apps.connections.open", {
      method: "POST",
      headers: { Authorization: `Bearer ${appToken}` },
    });
    const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
    if (!data.ok || !data.url) {
      throw new Error(`Socket Mode connect failed: ${data.error ?? "no URL returned"}`);
    }
    return new WebSocket(data.url);
  }

  async function run() {
    while (running) {
      try {
        console.log(`[${ts()}] Socket Mode: connecting...`);
        const ws = await connect();

        await new Promise<void>((resolve) => {
          ws.onopen = () => {
            console.log(`[${ts()}] Socket Mode: connected`);
          };

          ws.onmessage = async (event) => {
            try {
              const envelope: SocketEnvelope = JSON.parse(
                typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data as ArrayBuffer),
              );

              // Always acknowledge immediately to prevent retries
              if (envelope.envelope_id) {
                ws.send(JSON.stringify({ envelope_id: envelope.envelope_id }));
              }

              if (envelope.type === ENVELOPE_TYPE.HELLO) {
                console.log(`[${ts()}] Socket Mode: hello received`);
                return;
              }

              if (envelope.type !== ENVELOPE_TYPE.EVENTS_API) return;

              const slackEvent = envelope.payload?.event;
              if (!slackEvent) return;

              // Only handle app_mention and message events
              if (slackEvent.type !== EVENT_TYPE.APP_MENTION && slackEvent.type !== EVENT_TYPE.MESSAGE) return;

              // Skip bot messages to avoid loops
              if (slackEvent.bot_id) return;

              // Skip messages without text
              if (!slackEvent.text?.trim()) return;

              // Authorization check
              if (slackEvent.user && !isAuthorized(slackEvent.user, allowedUserIds)) {
                console.log(`[${ts()}] Socket Mode: unauthorized user ${slackEvent.user}`);
                return;
              }

              // Build inbox item matching the Rust runtime's format
              const item: SlackInboxItem = {
                type: "llm",
                correlation_id: uuid(),
                profile: "aeri",
                channel_id: slackEvent.channel,
                event_ts: slackEvent.ts,
                thread_ts: slackEvent.thread_ts ?? slackEvent.ts,
                user: slackEvent.user ?? "unknown",
                message: stripMention(slackEvent.text),
                plan_mode: false,
              };

              // RPUSH to Redis inbox
              await redis.rpush(inboxKey, JSON.stringify(item));
              console.log(`[${ts()}] Socket Mode: queued "${truncate(item.message, 60)}" from ${item.user}`);
            } catch (err) {
              console.error(`[${ts()}] Socket Mode: event parse error:`, err);
            }
          };

          ws.onclose = (event) => {
            console.log(`[${ts()}] Socket Mode: disconnected (code=${event.code})`);
            resolve();
          };

          ws.onerror = (err) => {
            const detail = err instanceof Error ? `: ${err.message}` : "";
            console.error(`[${ts()}] Socket Mode: WebSocket error${detail}`);
            ws.close();
          };
        });

        // Brief delay before reconnect
        if (running) {
          console.log(`[${ts()}] Socket Mode: reconnecting in 3s...`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      } catch (err) {
        console.error(`[${ts()}] Socket Mode: connection error:`, err);
        if (running) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }

  // Run in background (don't await — it loops forever)
  run().catch((err) => console.error(`[${ts()}] Socket Mode: fatal error:`, err));
}

// ─── Main ───────────────────────────────────────────────────────────

export async function slack(): Promise<void> {
  await initConfig();
  const settings = await loadSettings();
  const { slack: config } = settings;

  if (!config.botToken) {
    console.error("Slack bot token not configured. Set slack.botToken in settings.json");
    process.exit(1);
  }
  if (!config.redisUrl) {
    console.error("Redis URL not configured. Set slack.redisUrl in settings.json");
    process.exit(1);
  }
  if (!config.inboxKey) {
    console.error("Redis inbox key not configured. Set slack.inboxKey in settings.json");
    process.exit(1);
  }

  // Ensure project CLAUDE.md and session exist before processing messages
  await ensureProjectClaudeMd();
  await bootstrap();

  console.log(`[${ts()}] Slack bridge starting...`);
  console.log(`  Redis: ${config.redisUrl.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`  Inbox: ${config.inboxKey}`);
  console.log(`  Socket Mode: ${config.appToken ? "enabled" : "disabled (no appToken)"}`);
  console.log(`  Authorized users: ${config.allowedUserIds.length > 0 ? config.allowedUserIds.join(", ") : "all"}`);

  const redis = new Redis(config.redisUrl, {
    retryStrategy: (times) => Math.min(times * 1000, 30000),
    maxRetriesPerRequest: null, // Never give up on BLPOP
  });

  redis.on("connect", () => console.log(`[${ts()}] Redis connected`));
  redis.on("error", (err) => console.error(`[${ts()}] Redis error: ${err.message}`));

  const shutdown = () => {
    console.log(`[${ts()}] Shutting down Slack bridge...`);
    running = false;
    redis.disconnect();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start Socket Mode listener if appToken is configured
  if (config.appToken) {
    await startSocketMode(config.appToken, redis, config.inboxKey, config.allowedUserIds);
  }

  console.log(`[${ts()}] Listening for messages on ${config.inboxKey}...`);

  while (running) {
    try {
      const result = await redis.blpop(config.inboxKey, 30);
      if (!result) continue; // timeout, loop again

      const [, raw] = result;
      let item: SlackInboxItem;
      try {
        item = JSON.parse(raw);
      } catch {
        console.error(`[${ts()}] Invalid JSON in inbox: ${raw.slice(0, 100)}`);
        continue;
      }

      if (item.type !== "llm") {
        console.log(`[${ts()}] Skipping non-LLM item: ${item.type}`);
        continue;
      }

      // Authorization check
      if (!isAuthorized(item.user, config.allowedUserIds)) {
        console.log(`[${ts()}] Unauthorized user: ${item.user}`);
        continue;
      }

      console.log(`[${ts()}] Message from ${item.user}: ${truncate(item.message, 80)}`);

      // Build prompt with Slack context
      const promptParts = [
        `[Slack from ${item.user} in ${item.channel_id}]`,
      ];
      if (item.thread_ts && item.thread_ts !== item.event_ts) {
        promptParts.push(`[thread:${item.thread_ts}]`);
      }
      promptParts.push(`Message: ${item.message}`);

      const prompt = promptParts.join("\n");

      // Run through Claude CLI
      const claudeResult = await runUserMessage("slack", prompt);

      if (!claudeResult.stdout.trim()) {
        console.log(`[${ts()}] Empty response from Claude`);
        continue;
      }

      // Format and send response to Slack
      await sendSlackResult(
        config.botToken,
        item.channel_id,
        claudeResult.stdout,
        item.thread_ts
      );

      console.log(`[${ts()}] Replied to ${item.user} in ${item.channel_id}`);
    } catch (err) {
      if (running) {
        console.error(`[${ts()}] Error processing message:`, err);
        // Brief pause before retry to avoid tight error loops
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
}
