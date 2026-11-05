# One database, many organizations

**Status:** proposed

## Context

Anyone can create an organization, and one Firestore database holds them all. A member of one organization reading another's people, gives or settings is the worst bug this product can have. The free Pages address (`kudocoin.pages.dev`) cannot take a subdomain per organization.

## Decision

**Address.** An organization lives at `/o/<slug>`. The slug is lowercase letters, digits and hyphens, 3 to 40 characters, starting with a letter, unique, and not in the reserved list (`new`, `join`, `admin`, `api`, `settings`, `kudocoin` and similar). It does not change after creation in the first release.

**Data.** Everything an organization holds lives under its document, `orgs/{orgId}`, with the members, ledger, seasons and invites as subcollections (`docs/decisions/ledger.md`). The organization id is random; the slug points to it through `slugs/{slug}`.

**Two locks.**
1. **The Worker.** Every route under `/orgs/{orgId}` loads the caller's membership from `orgs/{orgId}/members/{uid}` before doing anything, and answers 404 when there is none, the same as for an organization that does not exist. Ids come from the path and the signed-in user, never from the body.
2. **Firestore rules.** The browser reads Firestore directly for the leaderboard and history, and the rules allow a read only when `orgs/{orgId}/members/{request.auth.uid}` exists. No client writes anything (`allow write: if false`); only the Worker's service account writes.

## Consequences

- A test runs against the Firestore emulator with two organizations: a member of the first reads nothing of the second, and every client write is refused.
- Listing "my organizations" reads `users/{uid}/orgs`, a small index the Worker keeps with each join and leave, since rules cannot list across organizations.
- A person in two organizations has one account and two memberships, each with its own role and balance.

## Code

- `firebase/firestore.rules`
- `worker/src/middleware/membership.ts`
- `worker/src/repositories/`
