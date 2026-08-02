import crypto from 'crypto';

const COOKIE_NAME = 'pv_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function hmac(payload: string, key: string): string {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

function getSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('Missing ADMIN_PASSWORD environment variable');
  return secret;
}

/** Constant-time password comparison to avoid timing side-channels. */
export function checkPassword(candidate: string): boolean {
  const expected = getSecret();
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still run a comparison of equal length to keep timing roughly constant.
    crypto.timingSafeEqual(Buffer.alloc(b.length), Buffer.alloc(b.length));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function createSessionCookie(): string {
  const secret = getSecret();
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const encodedPayload = base64url(payload);
  const signature = hmac(encodedPayload, secret);
  const value = `${encodedPayload}.${signature}`;
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

export function isValidSession(cookieHeader: string | undefined): boolean {
  try {
    const secret = getSecret();
    const cookies = parseCookies(cookieHeader);
    const value = cookies[COOKIE_NAME];
    if (!value) return false;
    const [encodedPayload, signature] = value.split('.');
    if (!encodedPayload || !signature) return false;
    const expectedSignature = hmac(encodedPayload, secret);
    const sigA = Buffer.from(signature);
    const sigB = Buffer.from(expectedSignature);
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) return false;
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}
