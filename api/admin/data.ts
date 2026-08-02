import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidSession } from '../../services/adminAuth';
import { getAllRows } from '../../services/googleSheets';
import { buildDashboardData } from '../../services/analytics';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!isValidSession(req.headers.cookie)) {
    res.status(401).json({ ok: false, error: 'Not authenticated' });
    return;
  }

  try {
    const rows = await getAllRows();
    const dashboard = buildDashboardData(rows);
    res.status(200).json({ ok: true, data: dashboard });
  } catch (err) {
    console.error('GET /api/admin/data failed:', err);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
