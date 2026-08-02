/**
 * One-off local script: verifies the service account can reach a Google
 * Sheet the user already created and shared with it, then writes the header
 * row if it's empty. Not deployed — run with `npm run setup:sheet -- <SHEET_ID>`.
 *
 * Service accounts on personal (non-Workspace) GCP projects have zero Drive
 * storage quota, so they cannot own/create a new spreadsheet themselves —
 * the human owner must create the sheet in their own Drive and share it
 * (Editor) with the service account's client_email. This script picks up
 * from there.
 *
 * Reads the downloaded service-account JSON key directly from disk so the
 * private key never needs to pass through the shell as a literal argument.
 */
import fs from 'fs';
import path from 'path';

const KEY_FILE = path.join(process.env.USERPROFILE || '', 'Downloads', 'vercel-visitor-dashboard-95675cde67a4.json');
const SHEET_ID = process.argv[2];

async function main() {
  if (!SHEET_ID) {
    console.error('Usage: npm run setup:sheet -- <GOOGLE_SHEET_ID>');
    process.exit(1);
  }

  const raw = fs.readFileSync(KEY_FILE, 'utf8');
  const key = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string };

  process.env.GOOGLE_CLIENT_EMAIL = key.client_email;
  process.env.GOOGLE_PRIVATE_KEY = key.private_key;
  process.env.GOOGLE_PROJECT_ID = key.project_id;
  process.env.GOOGLE_SHEET_ID = SHEET_ID;

  // Imported after env vars are set since googleSheets.ts reads them at call time.
  const { ensureHeaders } = await import('../services/googleSheets');

  await ensureHeaders();
  console.log('Connected to spreadsheet', SHEET_ID, 'as', key.client_email);
  console.log('Header row verified/written.');
  console.log('URL:', `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
}

main().catch((err) => {
  console.error('setup-sheet failed:', err);
  process.exit(1);
});
