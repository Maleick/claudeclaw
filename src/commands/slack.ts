/**
 * Slack bridge — Redis consumer that reads from VanguardForge's inbox,
 * routes messages through Claude CLI, and posts responses to Slack.
 *
 * Usage:  claudeclaw slack
 *
 * Requires settings:
 *   slack.botToken   — Slack Bot OAuth token (xoxb-...)
 *   slack.redisUrl   — Redis connection URL
 *   slack.inboxKey   — Redis queue key (e.g., "vanguardclaw:bot:inbox:claw")
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

let running = true;

function ts() {
  return new Date().toLocaleTimeString();
}

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
  console.log(`  Redis: ${config.redisUrl}`);
  console.log(`  Inbox: ${config.inboxKey}`);
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
      if (config.allowedUserIds.length > 0 && !config.allowedUserIds.includes(item.user)) {
        console.log(`[${ts()}] Unauthorized user: ${item.user}`);
        continue;
      }

      const msgPreview = item.message.length > 80
        ? `${item.message.slice(0, 80)}...`
        : item.message;
      console.log(`[${ts()}] Message from ${item.user}: ${msgPreview}`);

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
