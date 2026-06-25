import { parseRosterScreenshot } from '../lib/parse-roster.js';

function json(res, status, body) { res.status(status).json(body); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body;
  try {
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else if (Buffer.isBuffer(req.body)) {
      body = JSON.parse(req.body.toString('utf8'));
    } else if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else {
      // Stream — read manually
      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on('data', c => chunks.push(c));
        req.on('end', resolve);
        req.on('error', reject);
      });
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
  } catch {
    return json(res, 400, { error: 'Could not parse request body' });
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
