import { parseRosterScreenshot } from '../lib/parse-roster.js';

function json(res, status, body) { res.status(status).json(body); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body;
  try {
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const buf = Buffer.concat(chunks);
    console.log('raw body length:', buf.length, '| first 20 bytes:', buf.slice(0, 20).toString('hex'), '| as text:', buf.slice(0, 100).toString('utf8'));
    body = JSON.parse(buf.toString('utf8'));
  } catch (e) {
    console.error('body parse error:', e.message, '| raw:', e.message);
    return json(res, 400, { error: 'Could not parse request body: ' + e.message });
  }

  const { imageData, mimeType } = body || {};
  if (!imageData) return json(res, 400, { error: 'Missing screenshot' });

  const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMime.includes(mimeType)) {
    return json(res, 400, { error: 'Screenshot must be a JPEG, PNG, or WebP image' });
  }

  // Strip data URL prefix if present
  const base64 = imageData.replace(/^data:[^;]+;base64,/, '');

  let champions;
  try {
    champions = await parseRosterScreenshot(base64, mimeType);
  } catch (e) {
    console.error('parse-roster error', e.message);
    return json(res, 422, { error: e.message });
  }

  console.log('parsed champions:', JSON.stringify(champions.slice(0, 5)));

  if (!champions.length) {
    return json(res, 422, { error: 'No champions found in screenshot. Please upload your roster screen.' });
  }

  return json(res, 200, { champions });
}
