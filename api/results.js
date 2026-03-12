// api/results.js
// Vercel serverless function — proxies result requests to The Racing API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date parameter required' });
  }

  const user = process.env.RACING_API_USER;
  const pass = process.env.RACING_API_PASS;

  if (!user || !pass) {
    return res.status(500).json({ error: 'API credentials not configured' });
  }

  try {
    const url = `https://api.theracingapi.com/v1/results?date=${date}&region=gb,ire`;
    const response = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64'),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
