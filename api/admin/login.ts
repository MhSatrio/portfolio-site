import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkPassword, createSessionCookie } from '../../services/adminAuth';

// Best-effort in-memory rate limit on login attempts (see api/track.ts for the
// same caveat: per-lambda-instance only, not distributed).
const attempts = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
    if (entry.count > MAX_ATTEMPTS) {
      res.status(429).json({ ok: false, error: 'Too many attempts, try again shortly' });
      return;
    }
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !checkPassword(password)) {
    res.status(401).json({ ok: false, error: 'Incorrect password' });
    return;
  }

  res.setHeader('Set-Cookie', createSessionCookie());
  res.status(200).json({ ok: true });
}
