export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminKey = process.env.ADMIN_KEY;
  const dbUrl    = process.env.VITE_FIREBASE_DATABASE_URL;
  const itvPath  = `${dbUrl}/admin/itvCard.json`;

  if (req.method === 'POST') {
    const auth = req.headers.authorization;
    if (!adminKey || auth !== `Bearer ${adminKey}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { raceIds, label, raceMeta } = req.body;
    const r = await fetch(itvPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raceIds, label, raceMeta: raceMeta || [], updatedAt: Date.now() }),
    });
    if (!r.ok) return res.status(500).json({ error: 'Firebase write failed' });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const r = await fetch(itvPath);
    const data = await r.json();
    return res.status(200).json(data || { raceIds: [], label: '' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
