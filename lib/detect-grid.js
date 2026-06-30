/**
 * Pixel-based grid detector for RSL roster screenshots.
 *
 * Algorithm:
 *   1. Find column pitch and row pitch from edge-signal peak spacing.
 *   2. Find the longest consistent run of peaks in each direction — this
 *      gives the horizontal and vertical extent of the card grid.
 *   3. Compute a single fixed origin (top-left of the first real card) from
 *      the first detected boundary in each run, correcting for the
 *      double-peak artefact each card border creates.
 *   4. If the first row at the computed origin fails the portrait test (i.e.
 *      it's a UI header strip), shift the origin down by one rowPitch and
 *      repeat until a portrait row is found.
 *   5. Generate every crop as:
 *        x = originX + ci * colPitch,  width  = colPitch  (fixed)
 *        y = originY + ri * rowPitch,  height = rowPitch  (fixed)
 *      No per-row recalculation — all rows share the same column grid.
 *   6. Filter each crop with isPortrait() (variance + colour-diversity check)
 *      to drop any remaining UI chrome, empty cells, or off-grid content.
 *
 * Rarity is NOT determined here — look it up from the champion DB after the
 * champion has been identified by name.
 */

import sharp from 'sharp';

const MIN_PITCH = 100;         // smallest believable card dimension in px
const MAX_PITCH = 500;         // largest believable card dimension in px
const SMOOTH_WIN = 7;          // box-filter width for sub-card art noise
const PITCH_PERCENTILE = 0.88; // high bar for pitch detection
const RUN_PERCENTILE   = 0.70; // lower bar for run-finding

// Portrait detection thresholds
const MIN_PORTRAIT_STDDEV = 20;  // luminance standard-deviation floor
const MIN_ACTIVE_BINS     = 4;   // histogram bins (out of 8) that must have ≥3% of pixels

// ---------------------------------------------------------------------------
// 1-D edge signals
// ---------------------------------------------------------------------------

function colEdgeSignal(data, width, height, CH, yA, yB) {
  const sig = new Float32Array(width);
  for (let x = 1; x < width - 1; x++) {
    let sum = 0;
    for (let y = yA; y < yB; y++) {
      const il = (y * width + x - 1) * CH;
      const ir = (y * width + x + 1) * CH;
      sum += Math.abs(data[ir]   - data[il])
           + Math.abs(data[ir+1] - data[il+1])
           + Math.abs(data[ir+2] - data[il+2]);
    }
    sig[x] = sum / (yB - yA);
  }
  return sig;
}

function rowEdgeSignal(data, width, height, CH, xA, xB) {
  const sig = new Float32Array(height);
  for (let y = 1; y < height - 1; y++) {
    let sum = 0;
    for (let x = xA; x < xB; x++) {
      const iu = ((y-1) * width + x) * CH;
      const id = ((y+1) * width + x) * CH;
      sum += Math.abs(data[id]   - data[iu])
           + Math.abs(data[id+1] - data[iu+1])
           + Math.abs(data[id+2] - data[iu+2]);
    }
    sig[y] = sum / (xB - xA);
  }
  return sig;
}

// ---------------------------------------------------------------------------
// Signal smoothing
// ---------------------------------------------------------------------------

function smooth(signal, windowSize) {
  const n = signal.length;
  const out = new Float32Array(n);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < n; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n-1, i + half); j++) {
      sum += signal[j]; count++;
    }
    out[i] = sum / count;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pitch detection
// ---------------------------------------------------------------------------

/**
 * Collapse all raw peaks within `radius` pixels of each other into a single
 * representative peak at the position of the highest signal value in the group.
 * This turns the wide multi-pixel edge clusters that card borders produce into
 * a single clean peak per boundary, giving consistent inter-peak spacings.
 */
function clusterPeaks(peaks, signal, radius = 40) {
  if (peaks.length === 0) return [];
  const merged = [];
  let i = 0;
  while (i < peaks.length) {
    // Collect all peaks within `radius` of peaks[i]
    let best = peaks[i];
    let j = i + 1;
    while (j < peaks.length && peaks[j] - peaks[i] <= radius) {
      if (signal[peaks[j]] > signal[best]) best = peaks[j];
      j++;
    }
    merged.push(best);
    i = j;
  }
  return merged;
}

function detectPitch(signal, minPitch, maxPitch) {
  const smoothed = smooth(signal, SMOOTH_WIN);
  const n = smoothed.length;
  const sorted = Float32Array.from(smoothed).sort();
  const threshold = sorted[Math.floor(n * PITCH_PERCENTILE)];

  // Collect all raw peaks above threshold (small min-distance to find clusters)
  const rawPeaks = [];
  for (let i = 1; i < n - 1; i++) {
    if (smoothed[i] > threshold && smoothed[i] >= smoothed[i-1] && smoothed[i] >= smoothed[i+1]) {
      if (rawPeaks.length === 0 || i - rawPeaks[rawPeaks.length-1] >= 3) {
        rawPeaks.push(i);
      }
    }
  }

  // Merge nearby peaks so each card boundary contributes exactly one peak
  const peaks = clusterPeaks(rawPeaks, smoothed, Math.floor(minPitch * 0.4));
  if (peaks.length < 3) return -1;

  const allSpacings = [];
  for (let i = 1; i < peaks.length; i++) allSpacings.push(peaks[i] - peaks[i-1]);

  function bestOf(candidates) {
    if (candidates.length === 0) return -1;
    let best = -1, bestCount = 0;
    for (const ref of candidates) {
      const tol = Math.max(8, ref * 0.08);
      const count = candidates.filter(s => Math.abs(s - ref) <= tol).length;
      if (count > bestCount) { bestCount = count; best = ref; }
    }
    return bestCount >= 2 ? Math.round(best) : -1;
  }

  // Strategy 1: direct pitch from spacings in [minPitch, maxPitch]
  const direct = allSpacings.filter(s => s >= minPitch && s <= maxPitch);
  const p1 = bestOf(direct);
  if (p1 > 0) return p1;

  // Strategy 2: pitch from consecutive pair-sums — each card boundary creates
  // two edge peaks (left and right border side), so the true pitch = sum of
  // two consecutive sub-pitch spacings.
  const pairSums = [];
  for (let i = 0; i + 1 < allSpacings.length; i++) {
    const s = allSpacings[i] + allSpacings[i + 1];
    if (s >= minPitch && s <= maxPitch) pairSums.push(s);
  }
  return bestOf(pairSums);
}

// ---------------------------------------------------------------------------
// Grid run detection
// ---------------------------------------------------------------------------

function findGridRun(signal, pitch) {
  const s = smooth(signal, SMOOTH_WIN);
  const n = s.length;
  const sorted = Float32Array.from(s).sort();
  const threshold = sorted[Math.floor(n * RUN_PERCENTILE)];

  const rawPeaks = [];
  for (let i = 1; i < n - 1; i++) {
    if (s[i] > threshold && s[i] >= s[i-1] && s[i] >= s[i+1]) {
      if (rawPeaks.length === 0 || i - rawPeaks[rawPeaks.length-1] >= 3) {
        rawPeaks.push(i);
      }
    }
  }

  // Merge clusters so each card boundary contributes exactly one representative peak
  const peaks = clusterPeaks(rawPeaks, s, Math.floor(pitch * 0.4));
  if (peaks.length < 2) return null;

  function longestRun(candidates) {
    let best = null;
    for (let si = 0; si < candidates.length; si++) {
      const run = [candidates[si]];
      for (let i = si + 1; i < candidates.length; i++) {
        const gap = candidates[i] - run[run.length - 1];
        if (Math.abs(gap - pitch) <= pitch * 0.2) run.push(candidates[i]);
        else if (gap > pitch * 1.25) break;
      }
      if (run.length > (best ? best.length : 0)) best = run;
    }
    return best;
  }

  // Strategy 1: standard run from all merged peaks
  let best = longestRun(peaks);
  if (best && best.length >= 4) return best;

  // Strategy 2: every-other-peak run — for images where each card boundary
  // creates two peaks (left and right border side) at ~pitch/2 spacing. Using
  // only even- or odd-indexed peaks gives peaks at ~pitch spacing.
  for (const offset of [0, 1]) {
    const sub = peaks.filter((_, i) => i % 2 === offset);
    const run = longestRun(sub);
    if (run && run.length > (best ? best.length : 0)) best = run;
  }

  return (best && best.length >= 2) ? best : null;
}

// ---------------------------------------------------------------------------
// Grid origin — computed once, applied to every row
// ---------------------------------------------------------------------------

/**
 * Given the run of detected boundary peaks and the cell pitch, return the
 * pixel coordinate of the first card's leading edge.
 *
 * Each card boundary generates two close gradient peaks (one per border side).
 * We measure the average inner-gap of those double-peak pairs and use half of
 * it to shift from the detected peak position to the true boundary midpoint.
 * Then origin = firstBoundaryMidpoint - pitch.
 */
function computeOrigin(run, pitch) {
  const innerGaps = [];
  for (let i = 1; i < run.length; i++) {
    const g = run[i] - run[i - 1];
    if (g > 0 && g < pitch * 0.45) innerGaps.push(g);
  }
  const doublePeakHalf = innerGaps.length > 0
    ? Math.round(innerGaps.reduce((a, b) => a + b, 0) / innerGaps.length / 2)
    : 0;

  const firstBoundary = run[0] + doublePeakHalf;
  return Math.max(0, firstBoundary - pitch);
}

// ---------------------------------------------------------------------------
// Portrait detection via luminance variance + histogram diversity
// ---------------------------------------------------------------------------

/**
 * Returns true if the crop looks like a champion portrait.
 *
 * Test 1 — luminance stddev ≥ MIN_PORTRAIT_STDDEV: rejects solid-colour UI.
 * Test 2 — ≥ MIN_ACTIVE_BINS luminance bins with ≥3% of pixels: rejects
 *   text-on-background headers (high contrast but only 2 clusters).
 *
 * Samples the centre 60% of the crop to avoid the card border ring.
 */
function isPortrait(cropData, cropWidth, cropHeight, CH) {
  const xA = Math.floor(cropWidth  * 0.2);
  const xB = Math.floor(cropWidth  * 0.8);
  const yA = Math.floor(cropHeight * 0.2);
  const yB = Math.floor(cropHeight * 0.8);

  let sum = 0, sumSq = 0, cnt = 0;
  const hist = new Array(8).fill(0);

  for (let y = yA; y < yB; y++) {
    for (let x = xA; x < xB; x++) {
      const idx = (y * cropWidth + x) * CH;
      const lum = (cropData[idx] * 299 + cropData[idx+1] * 587 + cropData[idx+2] * 114) / 1000;
      sum   += lum;
      sumSq += lum * lum;
      hist[Math.min(7, Math.floor(lum / 32))]++;
      cnt++;
    }
  }
  if (cnt === 0) return false;

  const mean       = sum / cnt;
  const stddev     = Math.sqrt(Math.max(0, sumSq / cnt - mean * mean));
  const minCount   = cnt * 0.03;
  const activeBins = hist.filter(h => h >= minCount).length;

  return stddev >= MIN_PORTRAIT_STDDEV && activeBins >= MIN_ACTIVE_BINS;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Detects the card grid and returns one fixed-size crop per champion portrait.
 *
 * Each item: { row, col, buffer }
 * All crops have exactly colPitch × rowPitch pixels — no size variation.
 * Column indices are consistent across every row (same originX, same pitch).
 */
export async function detectGrid(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const CH = 4;

  // --- Column pitch + run ---
  const yMidA = Math.floor(height * 0.25);
  const yMidB = Math.floor(height * 0.75);
  const colEdge = colEdgeSignal(data, width, height, CH, yMidA, yMidB);
  const colPitch = detectPitch(colEdge, MIN_PITCH, MAX_PITCH);
  if (colPitch < MIN_PITCH)
    throw new Error(`Column pitch detection failed (${colPitch}px). Is this a roster screenshot?`);

  const colRun = findGridRun(colEdge, colPitch);
  if (!colRun) throw new Error('Could not locate grid columns in image');
  console.log(`  colPitch=${colPitch}  colRun[${colRun.length}]: [${colRun.slice(0,6).join(', ')}${colRun.length>6?'…':''}]`);

  // Restrict row-edge signal to the detected grid columns
  const gridLeft  = Math.max(0,     colRun[0]                 - colPitch);
  const gridRight = Math.min(width,  colRun[colRun.length - 1] + colPitch);

  // --- Row pitch + run ---
  // Use a wider smoothing window for rows to suppress the strong intra-card
  // horizontal bands (star bar, level bar) that fall at half-card intervals.
  const rowEdge = rowEdgeSignal(data, width, height, CH, gridLeft, gridRight);
  let rowPitch = detectPitch(rowEdge, MIN_PITCH, MAX_PITCH);
  if (rowPitch < MIN_PITCH)
    throw new Error(`Row pitch detection failed (${rowPitch}px). Is this a roster screenshot?`);

  const rowRun = findGridRun(rowEdge, rowPitch);
  if (!rowRun) throw new Error('Could not locate grid rows in image');

  // --- Fixed grid origin (computed once, shared by every row) ---
  const originX = computeOrigin(colRun, colPitch);
  let   originY = computeOrigin(rowRun, rowPitch);

  // Grid extent: count cells between origin and the last detected boundary.
  const numCols = Math.round((colRun[colRun.length - 1] - originX) / colPitch);
  let   numRows = Math.round((rowRun[rowRun.length - 1] - originY) / rowPitch);

  // Shift originY down past any UI chrome rows (sort bar, header strip).
  // Sample pixels across the first row's portrait band; if luminance stddev
  // is below the portrait threshold, this row is solid-colour UI — skip it.
  const PORTRAIT_TOP    = 0.30;
  const PORTRAIT_BOTTOM = 0.15;
  const portraitOffsetY = Math.round(rowPitch * PORTRAIT_TOP);
  const portraitHeight  = Math.round(rowPitch * (1 - PORTRAIT_TOP - PORTRAIT_BOTTOM));

  // Shift originY past any UI chrome rows (sort bar, header strip).
  // For each candidate first row, count how many cells contain portrait-like
  // content (high intra-cell luminance variance). Solid-colour UI strips fail
  // this check; champion face cells pass it. If <40% of cells qualify, the
  // row is chrome and we skip down by one rowPitch.
  for (let attempt = 0; attempt < 4; attempt++) {
    const yA = originY + portraitOffsetY + Math.floor(portraitHeight * 0.1);
    const yB = originY + portraitOffsetY + Math.floor(portraitHeight * 0.9);
    if (yA >= height) break;

    let portraitCells = 0;
    for (let ci = 0; ci < numCols; ci++) {
      const xA = originX + ci * colPitch + Math.floor(colPitch * 0.1);
      const xB = originX + ci * colPitch + Math.floor(colPitch * 0.9);
      if (xA >= width) continue;
      let sum = 0, sumSq = 0, cnt = 0;
      for (let y = yA; y < Math.min(yB, height); y += 4) {
        for (let x = xA; x < Math.min(xB, width); x += 4) {
          const idx = (y * width + x) * CH;
          const lum = (data[idx] * 299 + data[idx+1] * 587 + data[idx+2] * 114) / 1000;
          sum += lum; sumSq += lum * lum; cnt++;
        }
      }
      if (cnt === 0) continue;
      const stddev = Math.sqrt(Math.max(0, sumSq / cnt - (sum / cnt) ** 2));
      if (stddev >= MIN_PORTRAIT_STDDEV) portraitCells++;
    }

    const portraitFraction = portraitCells / numCols;
    if (portraitFraction >= 0.40) break;  // enough cells have portrait content
    console.log(`  Row ${attempt} is chrome (${portraitCells}/${numCols} portrait cells) — shifting originY down`);
    originY += rowPitch;
    numRows = Math.max(0, numRows - 1);
  }

  console.log(`Grid: ${colPitch}px × ${rowPitch}px pitch`);
  console.log(`  Origin: (${originX}, ${originY})`);
  console.log(`  Extent: ${numCols} cols × ${numRows} rows`);

  if (numCols < 1 || numRows < 1)
    throw new Error('Grid extent too small — pitch detection may have failed');
  if (numCols * numRows > 1000)
    throw new Error(`Implausible cell count (${numCols * numRows}) — pitch detection failed`);

  // --- Generate all crops with fixed pitch, no per-cell filtering ---
  const crops = [];

  for (let ri = 0; ri < numRows; ri++) {
    const y = originY + ri * rowPitch + portraitOffsetY;
    if (y + portraitHeight > height) break;

    for (let ci = 0; ci < numCols; ci++) {
      const x = originX + ci * colPitch;
      if (x + colPitch > width) break;

      const cropBuffer = await sharp(imageBuffer)
        .extract({ left: x, top: y, width: colPitch, height: portraitHeight })
        .toBuffer();

      crops.push({ row: ri, col: ci, buffer: cropBuffer });
    }
  }

  console.log(`  Portrait crop size: ${colPitch}×${portraitHeight}px (offset ${portraitOffsetY}px from cell top)`);
  console.log(`  Total crops: ${crops.length} (${numCols} cols × ${Math.ceil(crops.length / numCols)} rows)`);
  return { colPitch, rowPitch, crops };
}
