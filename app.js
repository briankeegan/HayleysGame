const COLS = 8;
const ROWS = 13;
const GAP = 4;
const WIN_VALUE = 2048;
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
const restartBtn = document.getElementById("restartBtn");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayTextEl = document.getElementById("overlayText");
const playAgainBtn = document.getElementById("playAgainBtn");

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

function randomValue() {
  return Math.random() < 0.9 ? 2 : 4;
}

function chainSum(ch) {
  return ch.length ? ch[0].value * Math.pow(2, ch.length - 1) : 0;
}

function valueColor(v) {
  if (PALETTE[v]) return PALETTE[v];
  const hue = (Math.log2(v) * 61) % 360;
  return `hsl(${hue}, 70%, 55%)`;
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

function renderTiles() {
  const seen = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t) continue;
      seen.add(t.id);
      let el = tileEls.get(t.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "tile";
        tilesEl.appendChild(el);
        tileEls.set(t.id, el);
      }
      tileStyleFor(el, r, c, t.value);
    }
  }
  for (const [id, el] of tileEls) {
    if (!seen.has(id)) {
      el.remove();
      tileEls.delete(id);
    }
  }
}

function markPop(id) {
  const el = tileEls.get(id);
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
    return;
  }

  const points = chain.map(
    (t) => `${t.col * cellSize + cellSize / 2},${t.row * cellSize + cellSize / 2}`
  );
  if (pointer) {
    const rect = gridEl.getBoundingClientRect();
    points.push(`${pointer.clientX - rect.left},${pointer.clientY - rect.top}`);
  }
  chainLineEl.innerHTML = `<polyline points="${points.join(
    " "
  )}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="${Math.max(
    4,
    cellSize * 0.12
  )}" stroke-linecap="round" stroke-linejoin="round" />`;
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

function triggerWin() {
  gameOver = true;
  overlayTitleEl.textContent = "You Win!";
  overlayTextEl.textContent = `You reached ${WIN_VALUE}! Final score: ${score}.`;
  overlayEl.classList.add("visible");
  clearProgress();
}

function triggerLose() {
  gameOver = true;
  overlayTitleEl.textContent = "Game Over";
  overlayTextEl.textContent = `No more merges available. Final score: ${score}.`;
  overlayEl.classList.add("visible");
  clearProgress();
}

function performMerge() {
  const finalValue = chainSum(chain);
  const last = chain[chain.length - 1];

  for (const t of chain) grid[t.row][t.col] = null;

  const mergedId = nextId++;
  grid[last.row][last.col] = { id: mergedId, value: finalValue };
  score += finalValue;
  updateScoreDisplay();

  chain = [];
  updateChainVisuals();

  applyGravity();
  renderTiles();
  markPop(mergedId);

  if (finalValue >= WIN_VALUE) {
    triggerWin();
    return;
  }
  if (!hasAnyMove()) {
    triggerLose();
    return;
  }
  saveProgress();
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
  if (gameOver) return;
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
    if (lastRowDist <= 1 && lastColDist <= 1 && tile && tile.value === chainSum(chain)) {
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
      const requiredValue = chainSum(chain.slice(0, -1));
      if (anchorRowDist <= 1 && anchorColDist <= 1 && tile && tile.value === requiredValue) {
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
