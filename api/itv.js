import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';

const firebaseConfig = {
  apiKey:      process.env.VITE_FIREBASE_API_KEY,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId:   process.env.VITE_FIREBASE_PROJECT_ID,
  appId:       process.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getDatabase(app);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminKey = process.env.ADMIN_KEY;
  if (req.method === 'POST') {
    const auth = req.headers.authorization;
    if (!adminKey || auth !== `Bearer ${adminKey}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (req.method === 'GET') {
    const snap = await get(ref(db, 'admin/itvCard'));
    return res.status(200).json(snap.exists() ? snap.val() : { raceIds: [], label: '' });
  }

  if (req.method === 'POST') {
    const { raceIds, label } = req.body;
    await set(ref(db, 'admin/itvCard'), { raceIds, label, updatedAt: Date.now() });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
