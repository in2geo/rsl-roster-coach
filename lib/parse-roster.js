import Anthropic         from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import sharp             from 'sharp';

const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MATCH_RARITIES = ['Mythical', 'Legendary', 'Epic', 'Rare'];

// Cache champion list for the lifetime of the server process
let championCache = null;
async function getAllChampions() {
  if (championCache) return championCache;
  const { data } = await supabase
    .from('champions')
    .select('name, rarity, faction')
    .eq('game_id', 'raid_shadow_legends')
    .in('rarity', MATCH_RARITIES);
  championCache = data || [];
  return championCache;
}

// ---------------------------------------------------------------------------
// Step 2 — find the grid bounding box in the raw screenshot
// ---------------------------------------------------------------------------

async function findGridBounds(imageBase64, mediaType) {
  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 256,
    tools: [{
      name:        'grid_bounds',
      description: 'Return the pixel bounding box of the champion card grid',
      input_schema: {
        type:       'object',
        properties: {
          found:          { type: 'boolean',  description: 'true if a champion grid was found' },
          top:            { type: 'integer',  description: 'top pixel of the grid' },
          left:           { type: 'integer',  description: 'left pixel of the grid' },
          bottom:         { type: 'integer',  description: 'bottom pixel of the grid' },
          right:          { type: 'integer',  description: 'right pixel of the grid' },
          estimated_cols: { type: 'integer',  description: 'number of card columns in the grid' },
        },
        required: ['found'],
      },
    }],
    tool_choice: { type: 'tool', name: 'grid_bounds' },
    messages: [{
      role:    'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text',  text: `This is a Raid: Shadow Legends screenshot. Find the champion collection grid — the rectangular region containing rows and columns of champion portrait cards with coloured rarity borders.

Return the pixel coordinates of the grid's bounding box (top, left, bottom, right) and the number of card columns (estimated_cols).

Ignore everything outside the card grid: the header bar, the "By Rank" sort bar, filter icons, any champion detail panel, stats panels, equipment panels, or side menus.

If you cannot find a champion card grid, return found: false.` },
      ],
    }],
  });

  const tool = response.content.find(b => b.type === 'tool_use');
  if (!tool) throw new Error('Grid location call returned no structured response');
  const { found, top, left, bottom, right, estimated_cols } = tool.input;
  if (!found) {
    throw new Error(
      'No champion collection grid found in this screenshot. ' +
      'Please take a screenshot from the Collection screen — tap the grid icon ⊞ at the top of the Champions tab.'
    );
  }
  return { top, left, bottom, right, estimated_cols: estimated_cols || 4 };
}

// ---------------------------------------------------------------------------
// Step 3 — identify all champions in the isolated grid crop
// ---------------------------------------------------------------------------

async function identifyGrid(gridBuffer, champions) {
  const nameList = champions.map(c => c.name).join(', ');

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{
      name:        'identify_champions',
      description: 'Identify all champion cards visible in the grid image',
      input_schema: {
        type:       'object',
        properties: {
          cards: {
            type:  'array',
            items: {
              type:       'object',
              properties: {
                row:        { type: 'integer', description: '0-based row from the top' },
                col:        { type: 'integer', description: '0-based column from the left' },
                name:       { type: 'string',  description: 'Champion name from the provided list, or "unreadable"' },
                level:      { type: 'integer', description: 'Level number shown on the card' },
                stars:      { type: 'integer', description: 'Star count shown on the card' },
                confidence: { type: 'string',  enum: ['high', 'low'] },
              },
              required: ['row', 'col', 'name', 'confidence'],
            },
          },
        },
        required: ['cards'],
      },
    }],
    tool_choice: { type: 'tool', name: 'identify_champions' },
    messages: [{
      role:    'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: gridBuffer.toString('base64') } },
        { type: 'text',  text: `This is a cropped Raid: Shadow Legends champion collection grid — only the card grid, no surrounding UI.

For every complete champion card visible, return:
- row and col (0-based, top-left card is row 0 col 0)
- name: the closest match from the list below, or "unreadable" if you cannot tell
- level: the number shown on the card
- stars: the star count
- confidence: "high" if certain about the name, "low" if guessing

Only identify Rare (blue border), Epic (purple border), Legendary (orange border), and Mythical (red/rainbow border) champions. Return Common (grey) and Uncommon (green) cards as "unreadable" so they are skipped.

Champion name list:
${nameList}` },
      ],
    }],
  });

  const tool = response.content.find(b => b.type === 'tool_use');
  if (!tool) throw new Error('Champion identification call returned no structured response');
  return tool.input.cards || [];
}

// ---------------------------------------------------------------------------
// Follow-up — re-identify a single uncertain cell cropped from the grid
// ---------------------------------------------------------------------------

async function identifySingleCell(cellBuffer, row, col, champions) {
  const nameList = champions.map(c => c.name).join(', ');

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 64,
    messages: [{
      role:    'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cellBuffer.toString('base64') } },
        { type: 'text',  text: `This is a single Raid: Shadow Legends champion card at grid position row ${row}, col ${col}.

Which champion is it? Pick the closest match from this list:
${nameList}

Reply with ONLY the champion name from that list. Reply UNSURE if you genuinely cannot identify it.` },
      ],
    }],
  });

  return response.content[0]?.text?.trim() ?? 'UNSURE';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function parseRosterScreenshot(imageBase64, mediaType) {
  // Load the champion name+rarity list from Supabase
  console.log('Loading champion list...');
  const allChampions = await getAllChampions();
  console.log(`Loaded ${allChampions.length} Rare+ champions`);

  // ── Step 2: locate the grid bounding box ─────────────────────────────────
  console.log('Locating champion grid in screenshot...');
  const bounds = await findGridBounds(imageBase64, mediaType);
  console.log(`Grid bounds: top=${bounds.top} left=${bounds.left} bottom=${bounds.bottom} right=${bounds.right} cols=${bounds.estimated_cols}`);

  // Crop to the grid region
  const rawBuffer  = Buffer.from(imageBase64, 'base64');
  const gridW      = bounds.right  - bounds.left;
  const gridH      = bounds.bottom - bounds.top;
  const gridBuffer = await sharp(rawBuffer)
    .extract({ left: bounds.left, top: bounds.top, width: gridW, height: gridH })
    .jpeg({ quality: 92 })
    .toBuffer();

  // ── Step 3: identify all champions in the clean grid crop ────────────────
  console.log('Identifying champions in grid crop...');
  let cards = await identifyGrid(gridBuffer, allChampions);
  console.log(`Batch identification returned ${cards.length} cards`);

  // ── Follow-up: re-send each uncertain/unreadable card individually ────────
  const uncertain = cards.filter(c => c.confidence === 'low' || c.name === 'unreadable');
  if (uncertain.length) {
    console.log(`Following up on ${uncertain.length} uncertain cards...`);

    // Estimate cell size from grid dimensions and returned card positions
    const numCols = bounds.estimated_cols;
    const maxRow  = cards.reduce((m, c) => Math.max(m, c.row), 0);
    const numRows = maxRow + 1;
    const cellW   = Math.floor(gridW / numCols);
    const cellH   = numRows > 0 ? Math.floor(gridH / numRows) : cellW;

    await Promise.all(uncertain.map(async card => {
      const x = card.col * cellW;
      const y = card.row * cellH;
      const w = Math.min(cellW, gridW - x);
      const h = Math.min(cellH, gridH - y);
      if (w <= 0 || h <= 0) return;

      let cellBuffer;
      try {
        cellBuffer = await sharp(gridBuffer)
          .extract({ left: x, top: y, width: w, height: h })
          .jpeg({ quality: 92 })
          .toBuffer();
      } catch (e) {
        console.warn(`  Could not crop cell [${card.row},${card.col}]: ${e.message}`);
        return;
      }

      const guess = await identifySingleCell(cellBuffer, card.row, card.col, allChampions);
      console.log(`  Follow-up [${card.row},${card.col}]: "${guess}"`);
      if (guess && guess !== 'UNSURE') {
        card.name       = guess;
        card.confidence = 'high';
      }
    }));
  }

  // ── Map identified cards to champion DB records ───────────────────────────
  const results = [];
  for (const card of cards) {
    if (!card.name || card.name === 'unreadable' || card.name === 'UNSURE') continue;

    const match = allChampions.find(
      c => c.name.toLowerCase() === card.name.toLowerCase()
    );

    if (match) {
      console.log(`  [${card.row},${card.col}] "${match.name}" (${match.rarity}) ✓`);
      results.push({
        name:   match.name,
        rarity: match.rarity,
        level:  card.level ?? null,
        stars:  card.stars ?? null,
      });
    } else {
      console.log(`  [${card.row},${card.col}] "${card.name}" — not found in DB`);
    }
  }

  if (!results.length) {
    throw new Error('Could not identify any Rare+ champions. Try a clearer screenshot of your Collection screen.');
  }

  console.log(`Final: identified ${results.length}/${cards.length} cards`);
  return results;
}
