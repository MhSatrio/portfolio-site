import { z } from 'zod';
import type { TrackPayload } from '../types/tracking';

const EVENT_TYPES = [
  'page_view',
  'download',
  'button_click',
  'contact',
  'project_open',
  'external_link',
  'navigation',
] as const;

// Generous but bounded limits — reject anything absurd rather than truncate silently,
// so malformed/abusive payloads are visibly rejected (400) rather than quietly corrupted.
const shortStr = z.string().max(200).catch('');
const longStr = z.string().max(2000).catch('');
const idStr = z.string().min(1).max(100);

export const trackPayloadSchema = z.object({
  visitorId: idStr,
  sessionId: idStr,
  isNewSession: z.boolean().catch(false),
  eventType: z.enum(EVENT_TYPES),
  page: shortStr,
  pageTitle: shortStr,
  language: shortStr,
  timezone: shortStr,
  referrer: longStr,
  utmSource: shortStr,
  utmMedium: shortStr,
  utmCampaign: shortStr,
  button: shortStr,
  download: shortStr,
  project: shortStr,
  durationSeconds: z.number().finite().min(0).max(86400).catch(0),
});

export interface ValidationResult {
  ok: boolean;
  data?: TrackPayload;
  error?: string;
}

/** Parses and validates an incoming request body. Never throws. */
export function validateTrackPayload(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const result = trackPayloadSchema.safeParse(body);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, data: result.data };
}

/**
 * Prevents spreadsheet-formula injection: a cell value beginning with
 * =, +, -, or @ is interpreted as a formula by Sheets/Excel when opened.
 * Prefixing with an apostrophe forces it to be read as plain text.
 */
export function sanitizeForSheets(value: string): string {
  if (value.length === 0) return value;
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  // Strip control characters that could break row rendering.
  return value.replace(/[\r\n\t]+/g, ' ').trim();
}

export function sanitizeRecord<T extends object>(record: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = typeof value === 'string' ? sanitizeForSheets(value) : value;
  }
  return out as T;
}
