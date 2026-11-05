# The ledger and the balances

**Status:** proposed

## Context

Coins are the whole game, so a balance must always match what happened, and nobody may raise one from the browser. Firestore's free plan counts every read, so adding up the ledger on each screen would spend the quota fast.

## Decision

**The ledger is the truth.** Every movement is a document in `orgs/{orgId}/ledger/{entryId}`: who gave, who received, the amount, the reason, the kind (`give`, `award`, `correction`), the season and the time. An entry is never changed or deleted. A mistake is undone by a `correction` entry from an admin, with its reason.

**Balances are kept beside it.** `orgs/{orgId}/members/{uid}` holds the member's balance for the current season and what they gave and received today. `orgs/{orgId}/seasons/{seasonId}` holds the leaderboard: each member's name, picture and balance, so the screen reads one document.

**One transaction per movement.** The Worker reads the giver's and receiver's member documents and the season, checks the rules (`docs/decisions/allowance-and-limits.md`), and in the same Firestore transaction writes the ledger entry, both member documents and the leaderboard. If anything changed in between, Firestore refuses the commit and the Worker retries once; a second conflict answers "try again".

**Ids.** Every id is random. A give carries a client-made idempotency key, so a double tap or a retried request writes one entry, not two.

## Consequences

- A balance can always be rebuilt from the ledger. A script checks that they match (`make check-ledger`) and runs in CI against seeded data.
- A busy organization writes its leaderboard document on every give. Firestore handles about one write per second per document, far above what a team gives.
- History screens page through the ledger, newest first, a page at a time.

## Code

- `worker/src/services/give.ts`
- `worker/src/repositories/ledger.ts`
- `firebase/firestore.rules`
