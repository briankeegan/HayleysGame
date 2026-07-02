# Clubhouse setup checklist (one-time, ~15 minutes)

The clubhouse is the secret page at `clubhouse.html` on the game site.
Messages flow: page → relay (Cloudflare Worker) → comments on PR #33 →
Claude's listener → Claude replies as comments → page shows the thread.

Two things only Brian can do, because they need his accounts:

## 1. Create a GitHub token (the relay's key)

1. Go to https://github.com/settings/personal-access-tokens/new
2. Token name: `clubhouse-relay` · Expiration: 1 year (or custom)
3. Repository access: **Only select repositories** → `briankeegan/HayleysGame`
4. Permissions → Repository permissions:
   - **Issues: Read and write**
   - **Pull requests: Read and write**
   - everything else: No access
5. Generate, and copy the token (starts with `github_pat_…`). Keep it handy
   for step 2 — don't paste it anywhere else, especially not into the repo.

## 2. Create the relay (free Cloudflare Worker)

1. Sign up / log in at https://dash.cloudflare.com (free plan is fine)
2. Left sidebar: **Workers & Pages** → **Create** → **Create Worker**
3. Name it `hayleys-clubhouse` → Deploy (it deploys a hello-world first)
4. Click **Edit code**, delete everything, paste in the entire contents of
   `clubhouse/worker.js` from this repo → **Deploy**
5. Back on the worker's page: **Settings → Variables and Secrets** → add:
   | Name | Type | Value |
   |------|------|-------|
   | `SECRET_WORD` | Secret | the clubhouse password (you choose!) |
   | `GITHUB_TOKEN` | Secret | the token from step 1 |
   | `REPO` | Text | `briankeegan/HayleysGame` |
   | `PR_NUMBER` | Text | `33` |
6. Copy the worker's URL (looks like `https://hayleys-clubhouse.<your-name>.workers.dev`)

## 3. Hand off to Claude

Tell Claude the worker URL. Claude wires it into `clubhouse.html`
(`WORKER_URL` at the top of the script), verifies the whole loop end to
end, and turns on the reply listener. You never need to share the secret
word or the token with Claude.

## Notes

- PR #33 must stay open — it IS the message board. It's a draft PR so it
  can't be merged by accident.
- The thread is technically public (it's PR comments on a public repo),
  and the secret word only gates *posting*. Fine for game ideas; not for
  private stuff.
- To revoke everything instantly: delete the worker, or revoke the token
  at https://github.com/settings/personal-access-tokens
