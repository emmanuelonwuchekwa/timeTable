const crypto = require('crypto');

module.exports = async (req, res) => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ error: 'Storage not configured' });

  const key = req.headers['x-sync-key'];
  if (!key || key.length < 8) return res.status(401).json({ error: 'Missing or short sync key' });
  const k = 'planner:' + crypto.createHash('sha256').update(String(key)).digest('hex');

  const redis = (cmd) =>
    fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(cmd) }).then((r) => r.json());

  try {
    if (req.method === 'GET') {
      const r = await redis(['GET', k]);
      return res.status(200).json(r.result ? JSON.parse(r.result) : {});
    }
    if (req.method === 'PUT') {
      const body = JSON.stringify(req.body || {});
      if (body.length > 500000) return res.status(413).json({ error: 'Too large' });
      await redis(['SET', k, body]);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};