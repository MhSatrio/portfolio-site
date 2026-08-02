import { google, sheets_v4 } from 'googleapis';
import { COL, SHEET_HEADERS, sheetRowToArray, type SheetRow } from '../types/tracking';

const SHEET_NAME = 'Sheet1';
const DATA_RANGE = `${SHEET_NAME}!A2:X`;
const FULL_RANGE = `${SHEET_NAME}!A1:X`;

function getPrivateKey(): string {
  const raw = process.env.GOOGLE_PRIVATE_KEY || '';
  // Vercel env vars store literal "\n" sequences; the PEM parser needs real newlines.
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

let cachedAuth: InstanceType<typeof google.auth.JWT> | null = null;

export function getAuth(scopes: string[]) {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY environment variables');
  }
  return new google.auth.JWT({ email: clientEmail, key: privateKey, scopes });
}

function getSheetsClient(): sheets_v4.Sheets {
  if (!cachedAuth) {
    cachedAuth = getAuth(['https://www.googleapis.com/auth/spreadsheets']);
  }
  return google.sheets({ version: 'v4', auth: cachedAuth });
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('Missing GOOGLE_SHEET_ID environment variable');
  return id;
}

/** Writes the header row if it's missing or doesn't match the expected columns. */
export async function ensureHeaders(): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A1:X1` });
  const currentHeader = existing.data.values?.[0] || [];
  const matches = SHEET_HEADERS.every((h, i) => currentHeader[i] === h);
  if (matches) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [SHEET_HEADERS] },
  });
}

/**
 * Appends by writing to an explicitly computed row, never via the Sheets API's
 * own `values.append` table auto-detection. Google Sheets can silently
 * (re)convert a plain grid into a structured "Table" object behind the
 * scenes; when it does, `append`'s heuristic follows the Table's tracked
 * range rather than the sheet's actual last populated row, so new data can
 * land dozens or hundreds of rows below the real data instead of right after
 * it. Reading the real row count first and writing with `values.update` at
 * an exact range sidesteps that heuristic entirely.
 */
export async function appendRow(row: SheetRow): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const existingRows = await getAllRows();
  const targetRow = existingRows.length + 2; // +1 for the header, +1 for 1-based rows
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A${targetRow}:X${targetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [sheetRowToArray(row)] },
  });
}

function rowArrayToSheetRow(arr: unknown[]): SheetRow {
  const at = (i: number): string => (arr[i] === undefined || arr[i] === null ? '' : String(arr[i]));
  return {
    timestamp: at(COL.timestamp),
    visitorId: at(COL.visitorId),
    sessionId: at(COL.sessionId),
    eventType: at(COL.eventType),
    page: at(COL.page),
    pageTitle: at(COL.pageTitle),
    country: at(COL.country),
    region: at(COL.region),
    city: at(COL.city),
    browser: at(COL.browser),
    os: at(COL.os),
    device: at(COL.device),
    language: at(COL.language),
    timezone: at(COL.timezone),
    referrer: at(COL.referrer),
    utmSource: at(COL.utmSource),
    utmMedium: at(COL.utmMedium),
    utmCampaign: at(COL.utmCampaign),
    button: at(COL.button),
    download: at(COL.download),
    duration: at(COL.duration),
    returningVisitor: at(COL.returningVisitor) === 'Yes' ? 'Yes' : 'No',
    visitCount: Number(at(COL.visitCount)) || 0,
    emailStatus: (at(COL.emailStatus) as SheetRow['emailStatus']) || '',
  };
}

/** Reads every data row (header excluded). Fine at personal-portfolio scale. */
export async function getAllRows(): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: DATA_RANGE });
  const values = res.data.values || [];
  return values.filter((r) => r.length > 0).map(rowArrayToSheetRow);
}

export interface VisitorState {
  returningVisitor: 'Yes' | 'No';
  visitCount: number;
}

/**
 * Looks at existing rows for this visitor to decide whether they're returning
 * and what visit-count number this event belongs to. A new session increments
 * the count; any other event within an existing session reuses it.
 *
 * "Returning" must stay constant for every event inside one session — so it's
 * decided from rows in OTHER sessions only. (Using all prior rows, including
 * ones already appended earlier in this same session, would flip a
 * first-time visitor's own follow-up events to "returning" mid-session.)
 */
export async function computeVisitorState(visitorId: string, sessionId: string, isNewSession: boolean): Promise<VisitorState> {
  const rows = await getAllRows();
  const allPriorRows = rows.filter((r) => r.visitorId === visitorId);
  if (allPriorRows.length === 0) {
    return { returningVisitor: 'No', visitCount: 1 };
  }
  const otherSessionRows = allPriorRows.filter((r) => r.sessionId !== sessionId);
  const maxVisitCount = Math.max(0, ...allPriorRows.map((r) => r.visitCount));
  return {
    returningVisitor: otherSessionRows.length > 0 ? 'Yes' : 'No',
    visitCount: isNewSession ? maxVisitCount + 1 : Math.max(maxVisitCount, 1),
  };
}

export { FULL_RANGE };
