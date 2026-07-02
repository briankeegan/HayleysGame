# 🏰 Hayley's Clubhouse

This pull request is the home of the clubhouse conversation — the comments
below ARE the message thread shown on the secret clubhouse page.

**This PR stays open forever. Do not merge it.**

How it works:

- Messages typed on the clubhouse page are posted here as comments
  (via a small relay that checks the secret word first).
- Claude replies as comments on this same thread.
- The clubhouse page reads the comments back from GitHub's public API
  and shows both sides as a chat.
