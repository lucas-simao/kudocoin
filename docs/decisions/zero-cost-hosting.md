# Free plans only

**Status:** proposed

## Context

Kudocoin is a game. Nobody pays for it and it earns nothing, so running it must cost nothing, with no card on file that could turn a spike into a bill. It still needs a database, sign-in, a server that enforces the rules, and a place for the web app.

## Decision

**Firebase on the Spark plan** (free, no card) for two things only:
- **Authentication** with the GitHub and Google providers.
- **Firestore** as the database.

**Cloudflare on the free plan** for the rest:
- **Workers** runs the API (`worker/`). It verifies the Firebase sign-in, applies the organization's rules and writes Firestore through its REST API with a service account.
- **Pages** serves the web app (`web/`) and the public page, at `kudocoin.pages.dev` until there is a domain.

Firebase Cloud Functions are not used: they need the paid Blaze plan.

## Consequences

- No card anywhere. When a free quota runs out, the service refuses requests until the quota resets; it never bills. That is the failure we accept.
- The free quotas shape the code. At the time of writing: Firestore allows about 50,000 reads and 20,000 writes a day; Workers allows 100,000 requests a day with 10 ms of CPU each. Check `firebase.google.com/pricing` and Cloudflare's Workers limits before relying on a number.
  - The leaderboard is one document per organization and season, updated with each give, so showing it costs one read, not one per member.
  - A give is one Firestore transaction: a few reads and four writes.
  - The Worker keeps the Google access token and the Firebase signing keys in memory between requests instead of fetching them each time.
- Two providers to set up instead of one. Firebase holds the data and the sign-in; Cloudflare holds the code that runs.
- The Firestore emulator runs the database locally (`make dev`), so development never touches the free quota.

## Code

- `worker/wrangler.toml`
- `worker/src/firestore/`
- `firebase/firebase.json`
- `web/` (built and published to Pages)
