// Clubhouse relay — a Cloudflare Worker.
//
// The clubhouse page can't hold a GitHub credential (it's a public static
// page), so this tiny relay holds it instead. It accepts two actions:
//
//   { action: "verify", secret }                — is the secret word right?
//   { action: "post", name, secret, message }   — post a message to the thread
//
// Messages are posted as comments on the standing "Clubhouse" PR, formatted
// as "**<name> says:**" so the page can tell the two sides of the chat apart.
//
// Required settings (Worker → Settings → Variables and Secrets):
//   SECRET_WORD   (secret)  — the clubhouse password
//   GITHUB_TOKEN  (secret)  — fine-grained PAT for this repo only
//   REPO          (text)    — briankeegan/HayleysGame
//   PR_NUMBER     (text)    — 33

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      // Visiting the relay URL in a browser shows which version is deployed
      // and whether its settings are present (never their values).
      return json(200, {
        relay: "r3",
        settings: {
          SECRET_WORD: env.SECRET_WORD ? "set" : "MISSING",
          GITHUB_TOKEN: env.GITHUB_TOKEN ? "set" : "MISSING",
          REPO: env.REPO || "MISSING",
          PR_NUMBER: env.PR_NUMBER || "MISSING",
        },
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(400, { error: "bad JSON" });
    }

    if (!payload.secret || payload.secret !== env.SECRET_WORD) {
      return json(403, { error: "wrong secret word" });
    }

    if (payload.action === "verify") {
      return json(200, { ok: true });
    }

    if (payload.action === "post") {
      const name = String(payload.name || "").trim().slice(0, 40);
      const message = String(payload.message || "").trim().slice(0, 4000);
      if (!name || !message) {
        return json(400, { error: "name and message required" });
      }
      // "Claude" is reserved for real replies posted from Claude's side.
      const safeName = /^claude$/i.test(name) ? `${name} (visitor)` : name;

      const res = await fetch(
        `https://api.github.com/repos/${env.REPO}/issues/${env.PR_NUMBER}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "clubhouse-relay",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({ body: `**${safeName} says:**\n\n${message}` }),
        }
      );
      if (!res.ok) {
        let detail = "";
        try {
          const body = await res.json();
          detail = body.message ? ` — ${body.message}` : "";
        } catch {}
        return json(502, {
          error: `github said ${res.status}${detail} [target: ${env.REPO}#${env.PR_NUMBER}] [relay r3]`,
        });
      }
      return json(200, { ok: true });
    }

    return json(400, { error: "unknown action" });
  },
};
