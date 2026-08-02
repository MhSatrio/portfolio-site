import type { VercelRequest, VercelResponse } from '@vercel/node';
import { UAParser } from 'ua-parser-js';
import { validateTrackPayload, sanitizeRecord } from '../services/validation';
import { ensureHeaders, appendRow, computeVisitorState } from '../services/googleSheets';
import { sendNewSessionEmail } from '../services/email';
import type { SheetRow } from '../types/tracking';

// Best-effort, per-lambda-instance rate limit. Not distributed across cold
// starts or concurrent instances — adequate for a personal portfolio's
// traffic level, not a substitute for a real edge rate limiter at scale.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const hits = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket?.remoteAddress || 'unknown';
}

function formatDuration(seconds: number): string {
  return `${Math.max(0, Math.round(seconds))}s`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    return;
  }

  const validation = validateTrackPayload(req.body);
  if (!validation.ok || !validation.data) {
    res.status(400).json({ ok: false, error: validation.error || 'Invalid payload' });
    return;
  }
  const payload = sanitizeRecord(validation.data);

  const country = (req.headers['x-vercel-ip-country'] as string) || '';
  const region = (req.headers['x-vercel-ip-country-region'] as string) || '';
  const city = decodeURIComponent((req.headers['x-vercel-ip-city'] as string) || '');
  const acceptLanguage = (req.headers['accept-language'] as string) || '';
  const userAgent = (req.headers['user-agent'] as string) || '';

  const ua = new UAParser(userAgent).getResult();
  const browser = [ua.browser.name, ua.browser.version?.split('.')[0]].filter(Boolean).join(' ') || 'Unknown';
  const os = [ua.os.name, ua.os.version].filter(Boolean).join(' ') || 'Unknown';
  const device = ua.device.type
    ? ua.device.type.charAt(0).toUpperCase() + ua.device.type.slice(1)
    : 'Desktop';

  try {
    await ensureHeaders();

    const { returningVisitor, visitCount } = await computeVisitorState(payload.visitorId, payload.sessionId, payload.isNewSession);

    let emailStatus: SheetRow['emailStatus'] = '';
    if (payload.isNewSession) {
      emailStatus = await sendNewSessionEmail({
        timestamp: new Date().toISOString(),
        visitorId: payload.visitorId,
        sessionId: payload.sessionId,
        returningVisitor,
        visitCount,
        country,
        region,
        city,
        browser,
        os,
        device,
        language: payload.language || acceptLanguage.split(',')[0] || '',
        timezone: payload.timezone,
        referrer: payload.referrer,
        page: payload.page,
        utmSource: payload.utmSource,
        utmMedium: payload.utmMedium,
        utmCampaign: payload.utmCampaign,
      });
    }

    const row: SheetRow = {
      timestamp: new Date().toISOString(),
      visitorId: payload.visitorId,
      sessionId: payload.sessionId,
      eventType: payload.eventType,
      page: payload.page,
      pageTitle: payload.pageTitle,
      country,
      region,
      city,
      browser,
      os,
      device,
      language: payload.language || acceptLanguage.split(',')[0] || '',
      timezone: payload.timezone,
      referrer: payload.referrer,
      utmSource: payload.utmSource,
      utmMedium: payload.utmMedium,
      utmCampaign: payload.utmCampaign,
      // No dedicated "Project" column in the spec's sheet schema — project_open
      // events carry the project name in Button, same as other click labels.
      button: payload.eventType === 'project_open' ? payload.project || payload.button : payload.button,
      download: payload.download,
      duration: formatDuration(payload.durationSeconds),
      returningVisitor,
      visitCount,
      emailStatus,
    };

    await appendRow(row);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('POST /api/track failed:', err);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
