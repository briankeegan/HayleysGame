const board = document.getElementById("board");

const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22"];
const BLOCK_COUNT = 6;
const BLOCK_SIZE = 84;

function spawnBlocks() {
  const boardRect = board.getBoundingClientRect();
  const cols = Math.max(1, Math.floor(boardRect.width / (BLOCK_SIZE + 16)));

  for (let i = 0; i < BLOCK_COUNT; i++) {
    const block = document.createElement("div");
    block.className = "block";
    block.style.background = COLORS[i % COLORS.length];
    block.textContent = i + 1;

    const col = i % cols;
    const row = Math.floor(i / cols);
    block.style.left = `${16 + col * (BLOCK_SIZE + 16)}px`;
    block.style.top = `${16 + row * (BLOCK_SIZE + 16)}px`;

    board.appendChild(block);
    makeDraggable(block);
  }
}

function makeDraggable(el) {
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");

    const elRect = el.getBoundingClientRect();
    offsetX = e.clientX - elRect.left;
    offsetY = e.clientY - elRect.top;
  });

  el.addEventListener("pointermove", (e) => {
    if (!el.classList.contains("dragging")) return;

    const boardRect = board.getBoundingClientRect();
    let x = e.clientX - boardRect.left - offsetX;
    let y = e.clientY - boardRect.top - offsetY;

    const maxX = boardRect.width - el.offsetWidth;
    const maxY = boardRect.height - el.offsetHeight;
    x = Math.min(Math.max(0, x), maxX);
    y = Math.min(Math.max(0, y), maxY);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  });

  const endDrag = (e) => {
    el.classList.remove("dragging");
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  };

  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
}

spawnBlocks();
