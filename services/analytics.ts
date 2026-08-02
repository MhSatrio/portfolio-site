import type { DashboardData, SheetRow } from '../types/tracking';

function parseDurationSeconds(duration: string): number {
  const match = /^(\d+(?:\.\d+)?)/.exec(duration);
  return match ? parseFloat(match[1]) : 0;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum);
  return date.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function topN(counts: Map<string, number>, n: number): { label: string; count: number }[] {
  return [...counts.entries()]
    .filter(([label]) => label && label.trim().length > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

function increment(map: Map<string, number>, key: string): void {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

const referrerLabel = (referrer: string): string => {
  if (!referrer) return 'Direct';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return referrer.slice(0, 60);
  }
};

export function buildDashboardData(rows: SheetRow[]): DashboardData {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - ((startOfToday.getUTCDay() + 6) % 7));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const sessionSeen = new Set<string>();
  const visitorSeen = new Set<string>();
  const returningVisitorIds = new Set<string>();

  const dailyVisitorsMap = new Map<string, Set<string>>(); // date -> set of visitorIds
  const weeklyVisitorsMap = new Map<string, Set<string>>();
  const monthlyVisitorsMap = new Map<string, Set<string>>();
  const downloadsByDate = new Map<string, number>();

  const browserCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const pageCounts = new Map<string, number>();
  const projectCounts = new Map<string, number>();
  const utmCampaignCounts = new Map<string, number>();
  const buttonCounts = new Map<string, number>();

  let resumeDownloads = 0;
  let marketingPortfolioDownloads = 0;
  let videoPortfolioDownloads = 0;
  let githubClicks = 0;
  let linkedinClicks = 0;
  let contactClicks = 0;
  let visitorsToday = 0;
  let visitorsThisWeek = 0;
  let visitorsThisMonth = 0;

  const sessionDurationBucketDefs: [string, number, number][] = [
    ['0–10s', 0, 10],
    ['10–30s', 10, 30],
    ['30–60s', 30, 60],
    ['1–3m', 60, 180],
    ['3–10m', 180, 600],
    ['10m+', 600, Infinity],
  ];
  const sessionDurationBuckets = new Map(sessionDurationBucketDefs.map(([label]) => [label, 0]));

  for (const row of rows) {
    const ts = new Date(row.timestamp);
    const valid = !Number.isNaN(ts.getTime());
    const dKey = valid ? dayKey(ts) : 'unknown';
    const wKey = valid ? weekKey(ts) : 'unknown';
    const mKey = valid ? monthKey(ts) : 'unknown';

    if (!dailyVisitorsMap.has(dKey)) dailyVisitorsMap.set(dKey, new Set());
    dailyVisitorsMap.get(dKey)!.add(row.visitorId);
    if (!weeklyVisitorsMap.has(wKey)) weeklyVisitorsMap.set(wKey, new Set());
    weeklyVisitorsMap.get(wKey)!.add(row.visitorId);
    if (!monthlyVisitorsMap.has(mKey)) monthlyVisitorsMap.set(mKey, new Set());
    monthlyVisitorsMap.get(mKey)!.add(row.visitorId);

    sessionSeen.add(row.sessionId);
    visitorSeen.add(row.visitorId);
    if (row.returningVisitor === 'Yes') returningVisitorIds.add(row.visitorId);

    if (valid && ts >= startOfToday) visitorsToday += 1;
    if (valid && ts >= startOfWeek) visitorsThisWeek += 1;
    if (valid && ts >= startOfMonth) visitorsThisMonth += 1;

    increment(browserCounts, row.browser);
    increment(osCounts, row.os);
    increment(deviceCounts, row.device);
    increment(countryCounts, row.country);
    increment(pageCounts, row.page);
    increment(referrerCounts, referrerLabel(row.referrer));
    increment(utmCampaignCounts, row.utmCampaign);
    if (row.eventType === 'button_click' || row.eventType === 'contact') increment(buttonCounts, row.button);
    if (row.eventType === 'project_open') increment(projectCounts, row.button);

    if (row.eventType === 'download') {
      increment(downloadsByDate, dKey);
      if (row.download === 'Resume') resumeDownloads += 1;
      else if (row.download === 'Marketing Portfolio') marketingPortfolioDownloads += 1;
      else if (row.download === 'Video Portfolio') videoPortfolioDownloads += 1;
    }
    if (row.button === 'GitHub') githubClicks += 1;
    if (row.button === 'LinkedIn') linkedinClicks += 1;
    if (row.eventType === 'contact') contactClicks += 1;

    const seconds = parseDurationSeconds(row.duration);
    for (const [label, min, max] of sessionDurationBucketDefs) {
      if (seconds >= min && seconds < max) {
        sessionDurationBuckets.set(label, (sessionDurationBuckets.get(label) || 0) + 1);
        break;
      }
    }
  }

  const totalDurationSeconds = rows.reduce((sum, r) => sum + parseDurationSeconds(r.duration), 0);
  const avgSessionDurationSeconds = rows.length > 0 ? totalDurationSeconds / rows.length : 0;

  const dailyVisitors = [...dailyVisitorsMap.entries()]
    .filter(([date]) => date !== 'unknown')
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, set]) => ({ date, count: set.size }));

  const weeklyVisitors = [...weeklyVisitorsMap.entries()]
    .filter(([week]) => week !== 'unknown')
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([week, set]) => ({ week, count: set.size }));

  const monthlyVisitors = [...monthlyVisitorsMap.entries()]
    .filter(([month]) => month !== 'unknown')
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, set]) => ({ month, count: set.size }));

  const downloadsOverTime = [...downloadsByDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, count]) => ({ date, count }));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      totalEvents: rows.length,
      totalSessions: sessionSeen.size,
      uniqueVisitors: visitorSeen.size,
      returningVisitors: returningVisitorIds.size,
      newVisitors: Math.max(0, visitorSeen.size - returningVisitorIds.size),
      visitorsToday,
      visitorsThisWeek,
      visitorsThisMonth,
      resumeDownloads,
      marketingPortfolioDownloads,
      videoPortfolioDownloads,
      githubClicks,
      linkedinClicks,
      contactClicks,
      avgSessionDurationSeconds: Math.round(avgSessionDurationSeconds),
    },
    charts: {
      dailyVisitors,
      weeklyVisitors,
      monthlyVisitors,
      downloadsOverTime,
      returningVsNew: {
        returning: returningVisitorIds.size,
        newCount: Math.max(0, visitorSeen.size - returningVisitorIds.size),
      },
      browserDistribution: topN(browserCounts, 8),
      osDistribution: topN(osCounts, 8),
      deviceDistribution: topN(deviceCounts, 8),
      countryDistribution: topN(countryCounts, 12),
      topReferrers: topN(referrerCounts, 10),
      topPages: topN(pageCounts, 10),
      topProjects: topN(projectCounts, 10),
      topUtmCampaigns: topN(utmCampaignCounts, 10),
      buttonClickFrequency: topN(buttonCounts, 10),
      sessionDurationBuckets: sessionDurationBucketDefs.map(([label]) => ({
        label,
        count: sessionDurationBuckets.get(label) || 0,
      })),
    },
    rows,
  };
}
