const COLS = 5;
const ROWS = 8;
const GAP = 4;
const MILESTONES = [2248, 4096, 8192, 16384, 32768, 65536, 131072];
const BEST_SCORE_KEY = "hayleysgame_best";
const STATE_KEY = "hayleysgame_state";
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

const boardEl = document.getElementById("board");
const gridEl = document.getElementById("grid");
const cellsEl = document.getElementById("cells");
const tilesEl = document.getElementById("tiles");
const chainLineEl = document.getElementById("chainLine");
const hoverRingEl = document.getElementById("hoverRing");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const chainReadoutEl = document.getElementById("chainReadout");
const restartBtn = document.getElementById("restartBtn");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayTextEl = document.getElementById("overlayText");
const playAgainBtn = document.getElementById("playAgainBtn");
const milestoneToastEl = document.getElementById("milestoneToast");

const PALETTE = {
  2: "#4fc3f7", 4: "#66bb6a", 8: "#ffa726", 16: "#ef5350", 32: "#ab47bc",
  64: "#26a69a", 128: "#ec407a", 256: "#ffee58", 512: "#5c6bc0",
  1024: "#8d6e63", 2048: "#ffd700",
};

let grid = [];
let tileEls = new Map();
let nextId = 1;
let cellSize = 0;
let score = 0;
let best = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
let chain = [];
let dragging = false;
let gameOver = false;
let boardAnimating = false;
let layoutPending = false;
let nextMilestoneIndex = 0;
let minSpawnTier = 2;

// New tiles spawn as one of 4 consecutive power-of-two tiers starting at the
// current floor (e.g. 2/4/8/16). Each tier is exactly twice as likely as the
// next (2 is 2x as likely as 4, 4 is 2x as likely as 8, ...): a geometric
// weighting of 8/15, 4/15, 2/15, 1/15. Once every tile of the floor value
// clears off the board, the whole window slides up a tier (floor doubles, so
// the window becomes 4/8/16/32, etc). Used for both the initial board fill
// and ongoing gravity refills, since both go through randomValue().
const SPAWN_WEIGHTS = [8 / 15, 4 / 15, 2 / 15, 1 / 15];

function randomValue() {
  let roll = Math.random();
  for (let i = 0; i < SPAWN_WEIGHTS.length; i++) {
    roll -= SPAWN_WEIGHTS[i];
    if (roll < 0) return minSpawnTier * 2 ** i;
  }
  return minSpawnTier * 2 ** (SPAWN_WEIGHTS.length - 1);
}

function chainSum(ch) {
  return ch.reduce((sum, t) => sum + t.value, 0);
}

// The merged tile's value is the running sum rounded to the nearest power of
// two (ties round down): 2-2-2 sums to 6, closer to 4 than 8, so it merges
// into 4; 2-2-2-2 sums to 8 exactly.
function closestPowerOfTwo(sum) {
  if (sum <= 0) return 0;
  const lower = 2 ** Math.floor(Math.log2(sum));
  const upper = lower * 2;
  return upper - sum < sum - lower ? upper : lower;
}

// A tile can extend the chain only if BOTH hold: it's at least as big as the
// tile it's following (the chain can never step down — 2-2-2-4 is valid,
// 2-2-2-4-2 is not, since once it's risen to 4 only 4-or-bigger can follow),
// AND everything gathered so far already sums to at least its value (so a
// lone 2 can't reach a 4 directly — it takes two 2s summing to 4 first).
function canFollow(chainSoFar, nextValue) {
  const last = chainSoFar[chainSoFar.length - 1].value;
  return nextValue >= last && chainSum(chainSoFar) >= nextValue;
}

// Shared with the in-progress chain's ring/bridge colors below, so both use
// the same log-scaled hue math — just fed a raw tile value here, and the
// chain's running sum there.
function hueForValue(v) {
  return (Math.log2(Math.max(1, v)) * 61) % 360;
}

function valueColor(v) {
  if (PALETTE[v]) return PALETTE[v];
  return `hsl(${hueForValue(v)}, 70%, 55%)`;
}

function textColorFor(bg) {
  const m = bg.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  let r, g, b;
  if (m) {
    [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  } else {
    const hm = bg.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+)%,\s*(\d+)%\)/);
    const [h, s, l] = [Number(hm[1]) / 360, Number(hm[2]) / 100, Number(hm[3]) / 100];
    const k = (n) => (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    r = Math.round(f(0) * 255);
    g = Math.round(f(8) * 255);
    b = Math.round(f(4) * 255);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#2d2d2d" : "#ffffff";
}

function boardHasValue(value) {
  return grid.some((row) => row.some((t) => t && t.value === value));
}

function updateMinSpawnTier() {
  while (!boardHasValue(minSpawnTier) && minSpawnTier < 2 ** 30) {
    minSpawnTier *= 2;
  }
}

// Every chain has to start with two equal adjacent tiles — canFollow's sum
// condition means a lone tile can only ever reach a same-valued neighbor
// (chainSum([t]) === t.value, so nextValue can be no bigger than t.value,
// and the non-decreasing condition means it can be no smaller either). So a
// move exists somewhere on the board iff some adjacent pair is equal.
function hasAnyMove() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t) continue;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const n = grid[nr][nc];
        if (n && n.value === t.value) return true;
      }
    }
  }
  return false;
}

function initGrid() {
  let attempts = 0;
  do {
    grid = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ id: nextId++, value: randomValue() }))
    );
    attempts++;
  } while (!hasAnyMove() && attempts < 20);
}

function resetGame() {
  clearProgress();
  gameOver = false;
  score = 0;
  chain = [];
  dragging = false;
  nextMilestoneIndex = 0;
  minSpawnTier = 2;
  overlayEl.classList.remove("visible");
  tilesEl.innerHTML = "";
  tileEls.clear();
  initGrid();
  updateScoreDisplay();
  layout();
  saveProgress();
}

function resumeGame(state) {
  gameOver = false;
  score = state.score || 0;
  chain = [];
  dragging = false;
  overlayEl.classList.remove("visible");
  tilesEl.innerHTML = "";
  tileEls.clear();
  grid = state.grid.map((row) =>
    row.map((v) => (v === null ? null : { id: nextId++, value: v }))
  );
  minSpawnTier = 2;
  updateMinSpawnTier();
  const highestTile = grid.flat().reduce((max, t) => (t ? Math.max(max, t.value) : max), 0);
  nextMilestoneIndex = MILESTONES.findIndex((m) => m > highestTile);
  if (nextMilestoneIndex === -1) nextMilestoneIndex = MILESTONES.length;
  updateScoreDisplay();
  layout();
}

function updateScoreDisplay() {
  scoreEl.textContent = String(score);
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_SCORE_KEY, String(best));
  }
  bestEl.textContent = String(best);
}

function saveProgress() {
  try {
    const state = {
      score,
      grid: grid.map((row) => row.map((cell) => (cell ? cell.value : null))),
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (err) {
    // localStorage can throw in private browsing / when full — progress just won't persist.
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch (err) {
    // ignore
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (
      !state ||
      !Array.isArray(state.grid) ||
      state.grid.length !== ROWS ||
      state.grid.some((row) => !Array.isArray(row) || row.length !== COLS)
    ) {
      return null;
    }
    return state;
  } catch (err) {
    return null;
  }
}

function layout() {
  // A resize mid-merge-animation (e.g. a mobile browser's address bar hiding
  // or showing while the player is dragging) would otherwise re-render every
  // tile — including ones mid-flight in the cascade animation — stomping on
  // their in-progress inline styles and animation classes. Defer instead.
  if (boardAnimating) {
    layoutPending = true;
    return;
  }
  const rect = boardEl.getBoundingClientRect();
  const maxWidth = rect.width - 16;
  const maxHeight = rect.height - 16;
  cellSize = Math.floor(Math.min(maxWidth / COLS, maxHeight / ROWS));
  const gridWidth = cellSize * COLS;
  const gridHeight = cellSize * ROWS;
  gridEl.style.width = `${gridWidth}px`;
  gridEl.style.height = `${gridHeight}px`;
  chainLineEl.setAttribute("viewBox", `0 0 ${gridWidth} ${gridHeight}`);

  cellsEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.left = `${c * cellSize + GAP / 2}px`;
      cell.style.top = `${r * cellSize + GAP / 2}px`;
      cell.style.width = `${cellSize - GAP}px`;
      cell.style.height = `${cellSize - GAP}px`;
      cellsEl.appendChild(cell);
    }
  }

  renderTiles();
}

function tileStyleFor(el, row, col, value) {
  el.style.left = `${col * cellSize + GAP / 2}px`;
  el.style.top = `${row * cellSize + GAP / 2}px`;
  el.style.width = `${cellSize - GAP}px`;
  el.style.height = `${cellSize - GAP}px`;
  const bg = valueColor(value);
  el.style.background = bg;
  el.style.color = textColorFor(bg);
  const digits = String(value).length;
  el.style.fontSize = `${cellSize * (digits >= 4 ? 0.32 : 0.42)}px`;
  el.textContent = String(value);
}

const FALL_BASE_MS = 220;
const FALL_PER_ROW_MS = 45;
const FALL_MAX_MS = 700;

function fallDurationFor(rowsFallen) {
  return Math.min(FALL_MAX_MS, FALL_BASE_MS + Math.max(0, rowsFallen) * FALL_PER_ROW_MS);
}

function renderTiles(animateNew, skipDropInId) {
  const seen = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t) continue;
      seen.add(t.id);
      let el = tileEls.get(t.id);
      const isNew = !el;
      if (isNew) {
        el = document.createElement("div");
        el.className = "tile";
        tilesEl.appendChild(el);
        tileEls.set(t.id, el);
      } else {
        // A tile that's still legitimately on the board should never carry a
        // leftover animation class from a prior cycle (e.g. a stray "removing"
        // from a race with an interrupted merge) — always start clean.
        el.classList.remove("removing", "dropping-in");
      }

      // Every tile settling into place after a merge — brand new spawns AND
      // existing tiles just falling to a new row via gravity — shares the same
      // bouncy transition, timed by how many rows it actually fell in its
      // column, so a tile dropping the full height of the board lands with
      // more weight than one that barely moved.
      const useSettleTransition = animateNew && t.id !== skipDropInId;
      let fallMs = FALL_BASE_MS;
      if (useSettleTransition) {
        const rowsFallen = isNew ? r + 1 : Math.max(0, r - Math.round(parseFloat(el.style.top) / cellSize));
        fallMs = fallDurationFor(rowsFallen);
        el.classList.add("dropping-in");
        el.style.transition = `top ${fallMs}ms cubic-bezier(0.22, 1.6, 0.36, 1), left 0.12s ease, opacity 0.2s ease`;
      }

      tileStyleFor(el, r, c, t.value);

      if (isNew && useSettleTransition) {
        const finalTop = el.style.top;
        el.style.top = `${-cellSize}px`;
        el.style.opacity = "0";
        void el.offsetWidth;
        requestAnimationFrame(() => {
          el.style.top = finalTop;
          el.style.opacity = "1";
        });
      }
      if (useSettleTransition) {
        setTimeout(() => {
          el.classList.remove("dropping-in");
          el.style.transition = "";
        }, fallMs + 50);
      }
    }
  }
  for (const [id, el] of tileEls) {
    if (!seen.has(id)) {
      tileEls.delete(id);
      el.classList.add("removing");
      setTimeout(() => el.remove(), 160);
    }
  }
}

function markPopEl(el) {
  if (!el) return;
  el.classList.remove("pop");
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth;
  el.classList.add("pop");
}

function cellFromEvent(e) {
  const rect = gridEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
  return { row, col };
}

// Returns nearby grid cells (the touched cell plus its 8 neighbors) sorted by
// distance to the raw pointer position. Diagonal drags land near a tile corner
// more often than straight drags do, so a little tolerance there goes a long
// way toward matching what a finger actually intended to touch.
function cellCandidates(x, y) {
  const baseCol = Math.floor(x / cellSize);
  const baseRow = Math.floor(y / cellSize);
  const candidates = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const row = baseRow + dr;
      const col = baseCol + dc;
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) continue;
      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;
      const dist = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      candidates.push({ row, col, dist });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates;
}

// Draws the in-progress chain as a ring hugging each selected tile's edge
// (never crossing over its number) plus short bridges across the gaps to
// the next tile, so the whole thing reads as one connected trail. Every
// ring/bridge is colored by hueForValue() fed the RUNNING SUM at that point
// in the chain (not the tile's own value), so the color visibly shifts as
// the total climbs — the same log-scaled math the game already uses for
// tile colors, just driven by the number that actually decides connectivity.
function updateChainVisuals(pointer) {
  for (const el of tileEls.values()) el.classList.remove("selected");
  for (const t of chain) {
    const tile = grid[t.row][t.col];
    if (tile) {
      const el = tileEls.get(tile.id);
      if (el) el.classList.add("selected");
    }
  }

  if (chain.length === 0) {
    chainLineEl.innerHTML = "";
    if (chainReadoutEl) chainReadoutEl.textContent = "–";
    return;
  }

  const ringInset = cellSize * 0.06;
  const ringWidth = Math.max(3, cellSize * 0.055);
  const ringRadius = cellSize * 0.14;
  const halfSize = (cellSize - GAP) / 2 - ringInset;

  let running = 0;
  const cumSums = chain.map((t) => (running += t.value));
  const centerOf = (t) => ({
    x: t.col * cellSize + cellSize / 2,
    y: t.row * cellSize + cellSize / 2,
  });

  // A dark outline behind every ring/bridge, plus a bright white core inside
  // the color, so the trail stays legible even when its hue happens to land
  // close to the tile it's sitting on (e.g. a run of 2s, which are already
  // blue, mapping to a blue-ish hue at a low running sum).
  const outlineWidth = ringWidth + cellSize * 0.05;
  const coreWidth = Math.max(1.5, ringWidth * 0.34);

  let svg = `<defs><filter id="chainGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${cellSize * 0.035}" /></filter></defs>`;

  const bridgeEndpoints = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = centerOf(chain[i]);
    const b = centerOf(chain[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    bridgeEndpoints.push({
      ax: a.x + (dx / dist) * halfSize,
      ay: a.y + (dy / dist) * halfSize,
      bx: b.x - (dx / dist) * halfSize,
      by: b.y - (dy / dist) * halfSize,
      color: `hsl(${hueForValue((cumSums[i] + cumSums[i + 1]) / 2)}, 85%, 62%)`,
    });
  }
  for (const { ax, ay, bx, by } of bridgeEndpoints) {
    svg += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="rgba(20,20,25,0.55)" stroke-width="${outlineWidth}" stroke-linecap="round" filter="url(#chainGlow)" />`;
  }
  for (const { ax, ay, bx, by, color } of bridgeEndpoints) {
    svg += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${color}" stroke-width="${ringWidth}" stroke-linecap="round" />`;
    svg += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#fff" stroke-width="${coreWidth}" stroke-linecap="round" opacity="0.9" />`;
  }

  const rings = chain.map((t, i) => ({
    rectX: t.col * cellSize + GAP / 2 + ringInset,
    rectY: t.row * cellSize + GAP / 2 + ringInset,
    rectSize: cellSize - GAP - ringInset * 2,
    color: `hsl(${hueForValue(cumSums[i])}, 85%, 62%)`,
  }));
  for (const { rectX, rectY, rectSize } of rings) {
    svg += `<rect x="${rectX}" y="${rectY}" width="${rectSize}" height="${rectSize}" rx="${ringRadius}" fill="none" stroke="rgba(20,20,25,0.55)" stroke-width="${outlineWidth}" filter="url(#chainGlow)" />`;
  }
  for (const { rectX, rectY, rectSize, color } of rings) {
    svg += `<rect x="${rectX}" y="${rectY}" width="${rectSize}" height="${rectSize}" rx="${ringRadius}" fill="none" stroke="${color}" stroke-width="${ringWidth}" />`;
    svg += `<rect x="${rectX}" y="${rectY}" width="${rectSize}" height="${rectSize}" rx="${ringRadius}" fill="none" stroke="#fff" stroke-width="${coreWidth}" opacity="0.9" />`;
  }

  if (pointer) {
    const rect = gridEl.getBoundingClientRect();
    const px = pointer.clientX - rect.left;
    const py = pointer.clientY - rect.top;
    const last = centerOf(chain[chain.length - 1]);
    const color = `hsl(${hueForValue(cumSums[cumSums.length - 1])}, 85%, 62%)`;
    svg += `<line x1="${last.x}" y1="${last.y}" x2="${px}" y2="${py}" stroke="rgba(20,20,25,0.5)" stroke-width="${ringWidth * 0.7 + 2}" stroke-linecap="round" />`;
    svg += `<line x1="${last.x}" y1="${last.y}" x2="${px}" y2="${py}" stroke="${color}" stroke-width="${ringWidth * 0.7}" stroke-linecap="round" opacity="0.75" />`;
    svg += `<circle cx="${px}" cy="${py}" r="${ringWidth * 0.85}" fill="${color}" stroke="rgba(20,20,25,0.55)" stroke-width="2" />`;
  }

  chainLineEl.innerHTML = svg;

  const sum = cumSums[cumSums.length - 1];
  if (chainReadoutEl) chainReadoutEl.textContent = `Σ${sum} ▸ ${closestPowerOfTwo(sum)}`;
}

function showHoverRing(row, col, status) {
  hoverRingEl.style.display = "block";
  hoverRingEl.style.left = `${col * cellSize + GAP / 2}px`;
  hoverRingEl.style.top = `${row * cellSize + GAP / 2}px`;
  hoverRingEl.style.width = `${cellSize - GAP}px`;
  hoverRingEl.style.height = `${cellSize - GAP}px`;
  hoverRingEl.className = `hover-ring ${status}`;
}

function hideHoverRing() {
  hoverRingEl.style.display = "none";
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const stack = [];
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c]) stack.push(grid[r][c]);
    }
    const newCol = new Array(ROWS).fill(null);
    let writeRow = ROWS - 1;
    for (let i = stack.length - 1; i >= 0; i--) {
      newCol[writeRow--] = stack[i];
    }
    for (let r = writeRow; r >= 0; r--) {
      newCol[r] = { id: nextId++, value: randomValue() };
    }
    for (let r = 0; r < ROWS; r++) grid[r][c] = newCol[r];
  }
}

let toastTimer = null;

function showMilestoneToast(value) {
  milestoneToastEl.textContent = `${value} reached!`;
  milestoneToastEl.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    milestoneToastEl.classList.remove("visible");
  }, 2200);
}

function checkMilestone(value) {
  while (nextMilestoneIndex < MILESTONES.length && value >= MILESTONES[nextMilestoneIndex]) {
    showMilestoneToast(MILESTONES[nextMilestoneIndex]);
    nextMilestoneIndex++;
  }
}

function triggerLose() {
  gameOver = true;
  overlayTitleEl.textContent = "Game Over";
  overlayTextEl.textContent =
    score >= best && score > 0
      ? `No more merges available. New high score: ${score}!`
      : `No more merges available. Final score: ${score}. Best: ${best}.`;
  overlayEl.classList.add("visible");
  clearProgress();
}

// Every merge animation takes exactly this long, full stop — a 2-tile merge
// (1 round) slows down to fill it, and a 20-tile chain (many rounds) speeds
// each round up to still land in the same window. Adjust this one number to
// retune the whole game's merge pacing.
const MERGE_TOTAL_MS = 610;

function roundDurationFor(roundCount) {
  // There's a pause before the first round shows AND one after the last
  // round finishes (to let it actually be seen before the grid snaps to its
  // final state) — roundCount+1 gaps total for roundCount rounds.
  return MERGE_TOTAL_MS / (roundCount + 1);
}

// Builds the round-by-round animation plan for a chain, in the exact order
// the player dragged it (chainOrder[0] = first tile touched, chainOrder[N-1]
// = the release point). Every "active" entry always right-aligns against the
// release point — active[k] always visually sits at chainOrder[N-L+k]'s cell,
// where L is however many entries remain — so as pairs merge away and the
// active list shrinks, everything still on the board slides over to close
// the gap, snake-style. Each round: find the RIGHTMOST adjacent pair with
// equal values and merge it (the right tile absorbs the left one and its
// value doubles, in place — not appended to the end); anything to the left of
// that pair shifts one slot right to stay compact; anything to the right of
// it was already correctly positioned and doesn't move. Repeat until no
// adjacent equal pair remains. If more than one entry is left over (or the
// natural cascade total doesn't land exactly on the rounded final value —
// e.g. an odd run, or non-equal-but-connectable neighbors), everything left
// sweeps into the release point, which snaps to the true final value.
function buildMergeRounds(chainOrder, finalValue) {
  const N = chainOrder.length;
  const positions = chainOrder.map((t) => ({ row: t.row, col: t.col }));
  const slotsFor = (list) => {
    const L = list.length;
    return list.map((_, k) => positions[N - L + k]);
  };

  let active = chainOrder.map((t) => ({ value: t.value, el: tileEls.get(t.id) }));
  const rounds = [];

  for (;;) {
    let mergeIdx = -1;
    for (let i = active.length - 2; i >= 0; i--) {
      if (active[i].value === active[i + 1].value) {
        mergeIdx = i;
        break;
      }
    }
    if (mergeIdx === -1) break;

    const oldSlots = slotsFor(active);
    const fromEntry = active[mergeIdx];
    const ontoEntry = active[mergeIdx + 1];
    const newValue = ontoEntry.value * 2;
    const newActive = [
      ...active.slice(0, mergeIdx),
      { value: newValue, el: ontoEntry.el },
      ...active.slice(mergeIdx + 2),
    ];
    const newSlots = slotsFor(newActive);

    const moves = [];
    for (let k = 0; k < newActive.length; k++) {
      if (k === mergeIdx) continue;
      const entry = newActive[k];
      const oldSlot = oldSlots[active.indexOf(entry)];
      const newSlot = newSlots[k];
      if (oldSlot.row !== newSlot.row || oldSlot.col !== newSlot.col) {
        moves.push({ type: "shift", el: entry.el, row: newSlot.row, col: newSlot.col });
      }
    }
    moves.push({
      type: "merge",
      fromEl: fromEntry.el,
      ontoEl: ontoEntry.el,
      row: newSlots[mergeIdx].row,
      col: newSlots[mergeIdx].col,
      value: newValue,
    });

    rounds.push(moves);
    active = newActive;
  }

  if (active.length > 1 || active[0].value !== finalValue) {
    const survivor = active[active.length - 1];
    const survivorSlot = positions[N - 1];
    const moves = [];
    for (let k = 0; k < active.length - 1; k++) {
      moves.push({
        type: "sweep",
        fromEl: active[k].el,
        row: survivorSlot.row,
        col: survivorSlot.col,
      });
    }
    moves.push({ type: "snap", el: survivor.el, value: finalValue });
    rounds.push(moves);
  }

  return rounds;
}

function applyMove(move) {
  switch (move.type) {
    case "shift": {
      move.el.style.left = `${move.col * cellSize + GAP / 2}px`;
      move.el.style.top = `${move.row * cellSize + GAP / 2}px`;
      break;
    }
    case "merge": {
      move.fromEl.style.left = `${move.col * cellSize + GAP / 2}px`;
      move.fromEl.style.top = `${move.row * cellSize + GAP / 2}px`;
      move.fromEl.classList.add("removing");
      move.ontoEl.textContent = String(move.value);
      const bg = valueColor(move.value);
      move.ontoEl.style.background = bg;
      move.ontoEl.style.color = textColorFor(bg);
      markPopEl(move.ontoEl);
      break;
    }
    case "sweep": {
      move.fromEl.style.left = `${move.col * cellSize + GAP / 2}px`;
      move.fromEl.style.top = `${move.row * cellSize + GAP / 2}px`;
      move.fromEl.classList.add("removing");
      break;
    }
    case "snap": {
      move.el.textContent = String(move.value);
      const bg = valueColor(move.value);
      move.el.style.background = bg;
      move.el.style.color = textColorFor(bg);
      markPopEl(move.el);
      break;
    }
  }
}

function performMerge() {
  const chainOrder = chain.map((t) => ({ ...t, id: grid[t.row][t.col].id }));
  const last = chainOrder[chainOrder.length - 1];
  const finalValue = closestPowerOfTwo(chainSum(chainOrder));

  chain = [];
  updateChainVisuals();
  hideHoverRing();
  boardAnimating = true;

  const rounds = buildMergeRounds(chainOrder, finalValue);
  const roundMs = roundDurationFor(Math.max(1, rounds.length));

  function finishMerge() {
    for (const t of chainOrder) grid[t.row][t.col] = null;
    grid[last.row][last.col] = { id: last.id, value: finalValue };
    score += finalValue;
    updateScoreDisplay();

    updateMinSpawnTier();
    applyGravity();
    renderTiles(true, last.id);

    checkMilestone(finalValue);
    boardAnimating = false;
    if (layoutPending) {
      layoutPending = false;
      layout();
    }

    if (!hasAnyMove()) {
      triggerLose();
      return;
    }
    saveProgress();
  }

  let roundIndex = 0;
  function playNextRound() {
    if (roundIndex >= rounds.length) {
      finishMerge();
      return;
    }
    for (const move of rounds[roundIndex++]) applyMove(move);
    setTimeout(playNextRound, roundMs);
  }

  setTimeout(playNextRound, roundMs);
}

function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  if (gridEl.hasPointerCapture(e.pointerId)) {
    gridEl.releasePointerCapture(e.pointerId);
  }
  if (chain.length >= 2) {
    performMerge();
  } else {
    chain = [];
    updateChainVisuals();
  }
  hideHoverRing();
}

gridEl.addEventListener("pointerdown", (e) => {
  if (gameOver || boardAnimating) return;
  const cell = cellFromEvent(e);
  if (!cell) return;
  const tile = grid[cell.row][cell.col];
  if (!tile) return;

  dragging = true;
  chain = [{ row: cell.row, col: cell.col, value: tile.value }];
  gridEl.setPointerCapture(e.pointerId);
  updateChainVisuals(e);
  showHoverRing(cell.row, cell.col, "valid");
});

gridEl.addEventListener("pointermove", (e) => {
  if (!dragging) return;

  const rect = gridEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const candidates = cellCandidates(x, y);

  for (const c of candidates) {
    const idxInChain = chain.findIndex((t) => t.row === c.row && t.col === c.col);

    if (idxInChain !== -1 && idxInChain < chain.length - 1) {
      // Retreating onto any earlier tile in the chain backtracks to that point,
      // not just the immediately-previous one — a fast or imprecise drag can
      // skip back past several already-chained tiles in a single move event.
      chain.length = idxInChain + 1;
      break;
    }
    if (idxInChain === chain.length - 1) {
      // Already resting on the current end of the chain — nothing to do.
      break;
    }

    const last = chain[chain.length - 1];
    const tile = grid[c.row][c.col];

    const lastRowDist = Math.abs(c.row - last.row);
    const lastColDist = Math.abs(c.col - last.col);
    if (lastRowDist <= 1 && lastColDist <= 1 && tile && canFollow(chain, tile.value)) {
      chain.push({ row: c.row, col: c.col, value: tile.value });
      break;
    }

    // Not a forward extension — but if it's a different, equally valid neighbor
    // of the tile BEFORE the current end, swap it in as the new end instead of
    // requiring the player to retrace back through the tile being replaced first.
    if (chain.length >= 2) {
      const anchor = chain[chain.length - 2];
      const anchorRowDist = Math.abs(c.row - anchor.row);
      const anchorColDist = Math.abs(c.col - anchor.col);
      if (anchorRowDist <= 1 && anchorColDist <= 1 && tile && canFollow(chain.slice(0, -1), tile.value)) {
        chain[chain.length - 1] = { row: c.row, col: c.col, value: tile.value };
        break;
      }
    }
  }

  if (candidates.length) {
    const nearest = candidates[0];
    const end = chain[chain.length - 1];
    const onChainEnd = nearest.row === end.row && nearest.col === end.col;
    showHoverRing(nearest.row, nearest.col, onChainEnd ? "valid" : "invalid");
  }

  updateChainVisuals(e);
});

gridEl.addEventListener("pointerup", endDrag);
gridEl.addEventListener("pointercancel", endDrag);

restartBtn.addEventListener("click", resetGame);
playAgainBtn.addEventListener("click", resetGame);

window.addEventListener("resize", layout);

const savedState = loadProgress();
if (savedState) {
  resumeGame(savedState);
} else {
  resetGame();
}
