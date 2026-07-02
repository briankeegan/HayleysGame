# Hayley's Game — the rules

This file is the source of truth for how the game works. When the rules
change in the code, this file gets updated to match. Ideas and requests for
new rules go in the Clubhouse (or straight to Claude) — once they ship,
they're written down here.

## The board

- 5 columns × 8 rows, always full of tiles.
- When tiles merge away, the tiles above fall down and brand-new tiles
  drop in from the top.

## Making a chain

- Drag through touching tiles — all 8 directions count, including diagonals.
- A tile can join your chain only if **both** are true:
  1. It is **at least as big** as the tile before it. The chain never steps
     down: 2-2-4 is fine, 2-2-4-2 is not.
  2. Everything gathered so far **adds up to at least its value**. A lone 2
     can't hop onto a 4 — you need two 2s (sum 4) before a 4 may join.
- Because of those two rules, every chain must start with **two equal
  touching tiles** — and that's also the game-over test.

## What a merge makes

- Add up the chain, then round to the **nearest power of two** (ties round
  down). 2+2+2 = 6 → makes a **4**. 2+2+2+2 = 8 → makes an **8**.
  2+2+4+8 = 16 → makes a **16**.
- The merged tile lands on the last tile you touched (where you let go).
- The new tile's value is added to your score. The chain readout in the
  header shows the running sum and what it will make (e.g. `Σ14 ▸ 16`).

## Smallest and biggest tiles

- New tiles spawn from a window of 4 sizes starting at the current
  **floor** — at first 2/4/8/16 — with small ones most likely
  (chances 8/4/2/1 out of 15).
- When the last floor-value tile leaves the board, the floor doubles
  (new tiles become 4/8/16/32, then 8/16/32/64, …). The floor never
  goes back down until you restart.
- There is **no biggest tile** — values can grow forever. Milestone
  celebrations fire at 2248 (probably meant to be 2048 — known typo),
  4096, 8192, and each doubling up to 131072.

## Game over

- When no two equal tiles touch anywhere on the board, no chain can be
  started, and the game ends. Your best score is remembered on your device.
