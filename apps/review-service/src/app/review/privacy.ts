/** Strip angle brackets / control chars for render-safe display. */
export function sanitizeText(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (ch === '<' || ch === '>') {
      continue;
    }
    if (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      continue;
    }
    out += ch;
  }
  return out.trim();
}

/**
 * Public display name: keep first token, mask the rest.
 * Never expose email/phone patterns as-is.
 */
export function maskDisplayName(raw?: string): string {
  const cleaned = sanitizeText(raw ?? '').replace(/\s+/g, ' ');
  if (!cleaned) {
    return 'Khách hàng NexaTech';
  }
  if (cleaned.includes('@')) {
    const local = cleaned.split('@')[0] ?? 'Khách';
    const visible = local.slice(0, Math.min(3, local.length));
    return `${visible}***`;
  }
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    const word = parts[0];
    if (word.length <= 2) {
      return `${word[0] ?? 'K'}***`;
    }
    return `${word.slice(0, 1)}***`;
  }
  return `${parts[0]} ***`;
}
