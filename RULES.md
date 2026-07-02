# Hayley's Game — the rules

This file is the source of truth for how the game works. When the rules
change in the code, this file gets updated to match. Ideas and requests for
new rules go in the Clubhouse (or straight to Claude) — once they ship,
they're written down here.

## The board

- 5 columns × 8 rows, always full of tiles.
- The board starts as a random mix of 2 through 128 (all seven sizes
  equally likely).
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

- New tiles fall from the top as one of **7 sizes, all equally likely** —
  2 through 128 to start.
- **Milestone blocks retire the smallest size**: the moment a **2048** is
  created, every 2 vanishes from the board, 2s stop falling, and **256**
  joins the falling rotation (window becomes 4–256). At **16384** the 4s
  vanish and 512 arrives (8–512). The pattern repeats forever, each
  milestone 8× the last (2048, 16384, 131072, …).
- There is **no biggest tile** — values can grow forever. Milestone
  celebrations fire at 2048, 4096, 8192, and each doubling up to 131072.

## Game over

- When no two equal tiles touch anywhere on the board, no chain can be
  started, and the game ends. Your best score is remembered on your device.
