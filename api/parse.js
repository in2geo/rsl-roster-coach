import busboy from 'busboy';
import { parseRosterScreenshot } from '../lib/parse-roster.js';

export const config = { api: { bodyParser: false } };

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
    const files = {};

    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', d => chunks.push(d));
      stream.on('end',  ()  => {
        files[name] = { buffer: Buffer.concat(chunks), mimeType: info.mimeType };
      });
    });

    bb.on('finish', () => resolve(files));
    bb.on('error',  reject);
    req.pipe(bb);
  });
}

function json(res, status, body) { res.status(status).json(body); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let files;
  try {
    files = await parseMultipart(req);
  } catch {
    return json(res, 400, { error: 'Could not parse request body' });
  }

  const screenshot = files.screenshot;
  if (!screenshot) return json(res, 400, { error: 'Missing screenshot' });

  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMime.includes(screenshot.mimeType)) {
    return json(res, 400, { error: 'Screenshot must be a JPEG, PNG, or WebP image' });
  }

  let champions;
  try {
    champions = await parseRosterScreenshot(
      screenshot.buffer.toString('base64'),
      screenshot.mimeType
    );
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
