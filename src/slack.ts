/**
 * Slack Web API client — zero external dependencies (uses fetch).
 * Handles message posting, reactions, and Markdown → mrkdwn conversion.
 */

const SLACK_API = "https://slack.com/api";
const SLACK_MAX_LENGTH = 3900; // Leave room for formatting overhead

interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

async function slackFetch(token: string, method: string, body: Record<string, unknown>): Promise<SlackApiResponse> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<SlackApiResponse>;
}

export async function postSlackMessage(
  token: string,
  channel: string,
  text: string,
  threadTs?: string
): Promise<boolean> {
  const body: Record<string, unknown> = { channel, text };
  if (threadTs) body.thread_ts = threadTs;
  const result = await slackFetch(token, "chat.postMessage", body);
  if (!result.ok) {
    console.error(`[slack] chat.postMessage error: ${result.error}`);
  }
  return result.ok;
}

export async function addSlackReaction(
  token: string,
  channel: string,
  timestamp: string,
  emoji: string
): Promise<boolean> {
  const result = await slackFetch(token, "reactions.add", {
    channel,
    timestamp,
    name: emoji.replace(/^:|:$/g, ""),
  });
  return result.ok;
}

/**
 * Convert standard Markdown to Slack mrkdwn format.
 *
 * Key differences:
 * - Bold: **text** → *text*
 * - Italic: *text* → _text_ (after bold conversion)
 * - Strikethrough: ~~text~~ → ~text~
 * - Links: [text](url) → <url|text>
 * - Headers: # text → *text* (bold, since Slack has no headers)
 */
export function markdownToMrkdwn(text: string): string {
  let result = text;

  // Headers → bold (Slack has no native headers)
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");

  // Bold: **text** → *text*
  result = result.replace(/\*\*(.+?)\*\*/g, "*$1*");

  // Italic (single underscore stays the same in Slack)
  // Single *text* (Markdown italic) needs special handling:
  // After bold conversion, remaining single * pairs are italic → convert to _text_
  // This is a simplified approach — edge cases with nested formatting are rare
  result = result.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "_$1_");

  // Strikethrough: ~~text~~ → ~text~
  result = result.replace(/~~(.+?)~~/g, "~$1~");

  // Links: [text](url) → <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

  return result;
}

/**
 * Split a long message into chunks that fit Slack's limit.
 * Tries to split on newlines or spaces for clean breaks.
 */
export function splitSlackMessage(text: string): string[] {
  if (text.length <= SLACK_MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= SLACK_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Find a good split point: prefer newline, then space
    let splitAt = remaining.lastIndexOf("\n", SLACK_MAX_LENGTH);
    if (splitAt < SLACK_MAX_LENGTH / 2) {
      splitAt = remaining.lastIndexOf(" ", SLACK_MAX_LENGTH);
    }
    if (splitAt < SLACK_MAX_LENGTH / 2) {
      splitAt = SLACK_MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

/**
 * Extract [react:emoji] directive from Claude output.
 * Returns { text, emoji } where text has the directive removed.
 */
export function extractReaction(text: string): { text: string; emoji: string | null } {
  const match = text.match(/\[react:([^\]]+)\]/);
  if (!match) return { text, emoji: null };
  return {
    text: text.replace(match[0], "").trim(),
    emoji: match[1],
  };
}

/**
 * Send a Claude result to Slack, handling chunking, mrkdwn conversion, and reactions.
 */
export async function sendSlackResult(
  token: string,
  channel: string,
  text: string,
  threadTs?: string
): Promise<void> {
  const { text: cleanText, emoji } = extractReaction(text);
  const formatted = markdownToMrkdwn(cleanText);
  const chunks = splitSlackMessage(formatted);

  for (const chunk of chunks) {
    await postSlackMessage(token, channel, chunk, threadTs);
  }

  if (emoji && threadTs) {
    await addSlackReaction(token, channel, threadTs, emoji);
  }
}
