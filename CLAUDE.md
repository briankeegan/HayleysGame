# Hayley's Game — session conventions

A static web game (no build system) deployed to GitHub Pages at
briankeegan.github.io/HayleysGame/. Game rules live in RULES.md — keep it
updated whenever gameplay changes.

## The Clubhouse (design-request pipeline)

- PR #33 is a permanently-open draft PR whose comments ARE a chat thread
  ("the clubhouse"). Never merge or close it.
- Messages are comments starting with `**<name> says:**`. Visitors post via
  clubhouse.html → a Cloudflare Worker relay. Claude replies by commenting
  on PR #33 with the same format: `**Claude says:**` body, ending with the
  current deploy version stamp on its own line, e.g. `[v0.107]`.
- The version number is `v0.<run_number>` of the latest "Deploy to GitHub
  Pages" workflow run (deploy-pages.yml). Merging to main triggers a deploy
  automatically, so a reply announcing shipped work should stamp the run
  the merge just triggered.

## Handling a clubhouse request

1. If it's a clear game change: implement on your working branch (rebased
   onto origin/main), verify in a headless browser (Playwright, chromium at
   /opt/pw-browsers/chromium), open a PR, and merge it immediately —
   merge-as-you-go is standing policy in this repo.
2. Update RULES.md if the rules changed.
3. Reply on PR #33 (friendly, non-technical — the collaborator may be a
   kid) with the version stamp.
4. If the request is ambiguous, reply with a clarifying question instead.

## Infrastructure notes

- Relay: Cloudflare Worker `sdsgame` (sdsgame.bramp-games.workers.dev),
  code in clubhouse/worker.js, deployed from this repo by Cloudflare's git
  integration (config: wrangler.jsonc). Its builds can be very slow/stuck —
  the owner can also paste code manually in the dashboard.
- Non-secret worker settings (REPO, PR_NUMBER) live in wrangler.jsonc vars;
  secrets (GITHUB_TOKEN, SECRET_WORD) live only in the Cloudflare
  dashboard. Never ask for or store token/secret values.
- Cloud sandboxes here usually can't reach workers.dev or github.io
  directly; verify via local server + Playwright, and use the GitHub MCP
  tools for GitHub.
- The game and clubhouse.html are a PWA (sw.js, network-first). Clients can
  lag a deploy behind; version stamps in the thread help spot stale caches.
