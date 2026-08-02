import nodemailer from 'nodemailer';
import type { EmailStatus } from '../types/tracking';

const RECIPIENT = 'satriorio182003@gmail.com';

export interface NewSessionEmailData {
  timestamp: string;
  visitorId: string;
  sessionId: string;
  returningVisitor: 'Yes' | 'No';
  visitCount: number;
  country: string;
  region: string;
  city: string;
  browser: string;
  os: string;
  device: string;
  language: string;
  timezone: string;
  referrer: string;
  page: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

function buildBody(d: NewSessionEmailData): string {
  return `Hi Rio,

Someone has started a new session on your portfolio.

Timestamp:
${d.timestamp}

Visitor ID:
${d.visitorId}

Session ID:
${d.sessionId}

Returning Visitor:
${d.returningVisitor}

Visit Count:
${d.visitCount}

Country:
${d.country || 'Unknown'}

Region:
${d.region || 'Unknown'}

City:
${d.city || 'Unknown'}

Browser:
${d.browser}

Operating System:
${d.os}

Device:
${d.device}

Language:
${d.language}

Timezone:
${d.timezone}

Referrer:
${d.referrer || 'Direct'}

Landing Page:
${d.page}

UTM Source:
${d.utmSource || 'None'}

UTM Medium:
${d.utmMedium || 'None'}

UTM Campaign:
${d.utmCampaign || 'None'}
`;
}

/**
 * Sends the single "new session" notification email. Returns 'Not Configured'
 * without attempting SMTP if Gmail credentials aren't set yet — this is the
 * expected state until EMAIL_USERNAME/EMAIL_PASSWORD are added and the project
 * is redeployed, not an error condition.
 */
export async function sendNewSessionEmail(data: NewSessionEmailData): Promise<EmailStatus> {
  const provider = process.env.EMAIL_PROVIDER || 'gmail';
  const user = process.env.EMAIL_USERNAME;
  const pass = process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    return 'Not Configured';
  }

  try {
    const transporter = nodemailer.createTransport({
      service: provider === 'gmail' ? 'gmail' : undefined,
      host: provider === 'gmail' ? undefined : provider,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Portfolio Analytics" <${user}>`,
      to: RECIPIENT,
      subject: 'New Portfolio Visitor',
      text: buildBody(data),
    });

    return 'Success';
  } catch (err) {
    console.error('sendNewSessionEmail failed:', err);
    return 'Failed';
  }
}
