const EMAIL_WEEKDAY =
  "(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"');
}

/** Keep the latest reply and drop Gmail/Outlook quoted history. */
export function stripQuotedEmailReply(raw: string): string {
  let text = decodeHtmlEntities(String(raw ?? "")).replace(/\u00a0/g, " ");
  const isoThenQuote = text.match(
    new RegExp(
      `^(\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}(?::\\d{2})?)\\s+On\\s+${EMAIL_WEEKDAY},`,
      "i",
    ),
  );
  if (isoThenQuote) return isoThenQuote[1].trim();

  const cutPatterns = [
    new RegExp(`\\sOn\\s+${EMAIL_WEEKDAY},[\\s\\S]*?\\bwrote:`, "i"),
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\n_{5,}\s*\nFrom:\s/i,
    /\nFrom:\s.+\nSent:\s/i,
  ];
  for (const pattern of cutPatterns) {
    const idx = text.search(pattern);
    if (idx > 0) {
      text = text.slice(0, idx);
      break;
    }
  }

  return text
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .trim();
}

export function truncate(text: string, maxLength = 120): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

export function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ticketActivityAt(ticket: {
  updated_at?: string | null;
  created_at?: string | null;
}): string | null {
  return ticket.updated_at || ticket.created_at || null;
}
