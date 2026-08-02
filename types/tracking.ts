export type EventType =
  | 'page_view'
  | 'download'
  | 'button_click'
  | 'contact'
  | 'project_open'
  | 'external_link'
  | 'navigation';

export type DownloadKind = 'Resume' | 'Marketing Portfolio' | 'Video Portfolio';

/** Payload sent by the browser to POST /api/track. */
export interface TrackPayload {
  visitorId: string;
  sessionId: string;
  isNewSession: boolean;
  eventType: EventType;
  page: string;
  pageTitle: string;
  language: string;
  timezone: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  button: string;
  download: string;
  project: string;
  durationSeconds: number;
}

export type EmailStatus = 'Success' | 'Failed' | 'Not Configured' | '';

/** One row as written to the Google Sheet, in header order. */
export interface SheetRow {
  timestamp: string;
  visitorId: string;
  sessionId: string;
  eventType: string;
  page: string;
  pageTitle: string;
  country: string;
  region: string;
  city: string;
  browser: string;
  os: string;
  device: string;
  language: string;
  timezone: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  button: string;
  download: string;
  duration: string;
  returningVisitor: 'Yes' | 'No';
  visitCount: number;
  emailStatus: EmailStatus;
}

export const SHEET_HEADERS: string[] = [
  'Timestamp',
  'Visitor ID',
  'Session ID',
  'Event Type',
  'Page',
  'Page Title',
  'Country',
  'Region',
  'City',
  'Browser',
  'OS',
  'Device',
  'Language',
  'Timezone',
  'Referrer',
  'UTM Source',
  'UTM Medium',
  'UTM Campaign',
  'Button',
  'Download',
  'Duration',
  'Returning Visitor',
  'Visit Count',
  'Email Status',
];

export function sheetRowToArray(row: SheetRow): (string | number)[] {
  return [
    row.timestamp,
    row.visitorId,
    row.sessionId,
    row.eventType,
    row.page,
    row.pageTitle,
    row.country,
    row.region,
    row.city,
    row.browser,
    row.os,
    row.device,
    row.language,
    row.timezone,
    row.referrer,
    row.utmSource,
    row.utmMedium,
    row.utmCampaign,
    row.button,
    row.download,
    row.duration,
    row.returningVisitor,
    row.visitCount,
    row.emailStatus,
  ];
}

/** Column indexes matching SHEET_HEADERS (0-based). */
export const COL = {
  timestamp: 0,
  visitorId: 1,
  sessionId: 2,
  eventType: 3,
  page: 4,
  pageTitle: 5,
  country: 6,
  region: 7,
  city: 8,
  browser: 9,
  os: 10,
  device: 11,
  language: 12,
  timezone: 13,
  referrer: 14,
  utmSource: 15,
  utmMedium: 16,
  utmCampaign: 17,
  button: 18,
  download: 19,
  duration: 20,
  returningVisitor: 21,
  visitCount: 22,
  emailStatus: 23,
} as const;

/** Aggregated data returned by GET /api/admin/data for the dashboard. */
export interface DashboardData {
  generatedAt: string;
  totals: {
    totalEvents: number;
    totalSessions: number;
    uniqueVisitors: number;
    returningVisitors: number;
    newVisitors: number;
    visitorsToday: number;
    visitorsThisWeek: number;
    visitorsThisMonth: number;
    resumeDownloads: number;
    marketingPortfolioDownloads: number;
    videoPortfolioDownloads: number;
    githubClicks: number;
    linkedinClicks: number;
    contactClicks: number;
    avgSessionDurationSeconds: number;
  };
  charts: {
    dailyVisitors: { date: string; count: number }[];
    weeklyVisitors: { week: string; count: number }[];
    monthlyVisitors: { month: string; count: number }[];
    downloadsOverTime: { date: string; count: number }[];
    returningVsNew: { returning: number; newCount: number };
    browserDistribution: { label: string; count: number }[];
    osDistribution: { label: string; count: number }[];
    deviceDistribution: { label: string; count: number }[];
    countryDistribution: { label: string; count: number }[];
    topReferrers: { label: string; count: number }[];
    topPages: { label: string; count: number }[];
    topProjects: { label: string; count: number }[];
    topUtmCampaigns: { label: string; count: number }[];
    buttonClickFrequency: { label: string; count: number }[];
    sessionDurationBuckets: { label: string; count: number }[];
  };
  rows: SheetRow[];
}
