import busboy from 'busboy';
import { parseRosterScreenshot } from '../lib/parse-roster.js';
import { matchRoster }           from '../lib/match-engine.js';
import { generateExplanation }   from '../lib/explain.js';

export const config = { api: { bodyParser: false } };

// ── Helpers ────────────────────────────────────────────────────────────────

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
    const fields = {};
    const files  = {};

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', d => chunks.push(d));
      stream.on('end',  ()  => {
        files[name] = {
          buffer:    Buffer.concat(chunks),
          mimeType:  info.mimeType,
          filename:  info.filename,
        };
      });
    });

    bb.on('finish', () => resolve({ fields, files }));
    bb.on('error',  reject);
    req.pipe(bb);
  });
}

function json(res, status, body) {
  res.status(status).json(body);
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let fields, files;
  try {
    ({ fields, files } = await parseMultipart(req));
  } catch (e) {
    return json(res, 400, { error: 'Could not parse request body' });
  }

  const contentKey = fields.content;
  const screenshot = files.screenshot;

  if (!contentKey || !screenshot) {
    return json(res, 400, { error: 'Missing screenshot or content field' });
  }

  const validContent = ['campaign', 'spider', 'clan_boss'];
  if (!validContent.includes(contentKey)) {
    return json(res, 400, { error: `Invalid content key: ${contentKey}` });
  }

  // Validate image MIME type
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMime.includes(screenshot.mimeType)) {
    return json(res, 400, { error: 'Screenshot must be a JPEG, PNG, or WebP image' });
  }

  // ── Step 1: Vision — read the screenshot into structured data
  let parsedChampions;
  try {
    const b64      = screenshot.buffer.toString('base64');
    const mimeType = screenshot.mimeType;
    parsedChampions = await parseRosterScreenshot(b64, mimeType);
  } catch (e) {
    console.error('parse-roster error', e.message);
    return json(res, 422, { error: e.message });
  }

  console.log('parsed champions:', JSON.stringify(parsedChampions.slice(0, 5)));

  if (!parsedChampions.length) {
    return json(res, 422, { error: 'No champions found in screenshot. Please upload your roster screen.' });
  }

  // ── Step 2: Matching engine — deterministic, no LLM
  let matchResult;
  try {
    matchResult = await matchRoster(parsedChampions, contentKey);
  } catch (e) {
    console.error('match-engine error', e);
    return json(res, 500, { error: 'Matching engine failed. Please try again.' });
  }

  // ── Step 3: Explanation — AI writes plain-language summary of the decision
  let explanation;
  try {
    explanation = await generateExplanation(matchResult);
  } catch (e) {
    console.error('explain error', e);
    explanation = 'Explanation unavailable right now — but your team above is still valid.';
  }

  return json(res, 200, {
    content_label: matchResult.content_label,
    team:          matchResult.team,
    gaps:          matchResult.gaps,
    explanation,
  });
}
