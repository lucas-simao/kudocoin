# Kudocoin

What the product is and its fixed rules live in `docs/product.md`; read it before changing product behaviour. The first release's scope is `docs/mvp.md`. Technical decisions are in `docs/decisions/`, one file per subject, shaped by `docs/decisions/_template.md`. A change that goes against a decision updates the decision in the same pull request.

## Layout

One repository. `worker/` is the API, a Cloudflare Worker in TypeScript, going route → service → repository. `web/` is the app and the public page, React with Vite. `firebase/` holds the Firestore rules, indexes and emulator settings. `brand/` holds the theme and the logo. `docs/` holds the product and the decisions.

## Money and cost

- A coin has no money value. Nothing in Kudocoin buys, sells, transfers out or cashes coins, and no text suggests it.
- Kudocoin runs on free plans only (`docs/decisions/zero-cost-hosting.md`). Do not add anything that needs a card on file or bills per use: no Cloud Functions, no paid Workers features, no paid APIs. Count Firestore reads and writes when adding a screen or a route; prefer one document the screen reads over a query that reads many.

## Organizations are tenants

Every route under `/orgs/{orgId}` loads the caller's membership first and answers 404 without one (`docs/decisions/organizations.md`).

- The organization id comes from the path and the user id from the verified token. Never from the request body.
- Everything an organization holds lives under `orgs/{orgId}`. A repository function takes the organization id as its first argument.
- Firestore rules let a member read their organization and refuse every client write. Only the Worker writes.

## Coins

- The ledger only grows (`docs/decisions/ledger.md`). An entry is never updated or deleted; a mistake gets a `correction` entry.
- A movement is one Firestore transaction: the ledger entry, both member documents and the leaderboard together.
- The give rules live as pure functions in `worker/src/services/rules.ts`, each with its tests. A new rule is not done without a test that it refuses what it should.

## Web

Screens import `@/features/{domain}`; the API client lives in `web/src/api`. Every word on screen goes through `t()`, with the keys in `web/src/i18n/locales/pt-BR.ts`, `en.ts` and `es.ts` (`docs/decisions/languages.md`). A pull request that adds a key adds it in all three. The API answers codes, and the web app turns them into words. Colors, fonts and radii come from `brand/theme.css`; never a hex in a component.

## What the public sees

Nothing on screen, in the public page or in examples shows a developer's machine: no `localhost`, `127.0.0.1`, ports or test hosts. Example people and organizations are made up.

## Comments

Comments explain a non-obvious why in at most 3 lines. Longer reasoning goes in a decision file, with a one-line summary and the path in the code. No dates, ticket ids or history in comments.

## Running

`make dev` starts the Firebase emulators (Auth and Firestore), the Worker and the web app together, with no cloud account. `make test` runs every test, including the Firestore rules against the emulator.
