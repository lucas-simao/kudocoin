# Claims and requests

**Status:** proposed

## Context

Two ways to chase coins are missing. Someone who did a bounty's task cannot say so, and the bounty waits for the one who offered it to remember (`bounties.md`). And someone who helped cannot ask for a thanks. Both should feel like a nudge, not a debt: the game stays playful, nobody loses coins, and every coin still comes from someone's allowance.

## Decision

### "I did it" on a bounty

**Claiming.** Any member other than the one who offered it can claim an open bounty: *I did it* on the site, or `/kudos bounty done #7` in Slack. The bounty keeps its claims as a map, `claims.{uid} = { name, at }`, at most 10. Claiming twice changes nothing. A bounty with a claim does not expire while the claim stands, so a task done on day 29 can still be paid.

**Answering.** The one who offered it, or an admin, pays a claimant with one click (the bounty's *Pay*, with the claimants first), or rejects a claim (*That's not it*, `/kudos bounty reject #7 @bruno`), which removes it.

**Paid by itself.** With exactly one claim, the bounty gets `autoPayAt`: seven days after the claim. A second claim or a rejection clears it; the remaining single claim sets it again from its own time. The hourly job (`sprints.md`) also asks Firestore for bounties whose `autoPayAt` has passed (a collection-group query, at most 50 a run) and pays each one to its claimant with the same `payBounty()`, recording that it was paid by itself. This is fair because the coins left the offerer's allowance when the bounty was offered: silence costs them nothing more. A claimant who has left the organization is skipped and the claim removed.

### Requests

**Asking.** A member asks another for coins with a reason: *Ask for coins* on the site, or `/kudos request @bruno 2 reviewed your PR` in Slack. A request lives in `orgs/{orgId}/requests/{id}`: who asks, who is asked, amount, reason, a number in the organization (`#3`), status (`open`, `paid`, `declined`, `cancelled`), and its last day, seven days later. The amount follows `maxPerGive`; the reason is required. A member has at most 3 open requests, and one open request to the same person.

**Answering.** The person asked can pay or decline. *Pay* is an ordinary give from them to the one who asked, under every give rule (`allowance-and-limits.md`), with the request's reason; if their allowance does not cover it today, they can pay another day before it expires. *Decline* closes it without a reason. The one who asked can cancel it. An open request past its last day shows as expired and can no longer be paid. A request is never paid by itself: unlike a bounty, its coins were never set aside.

**Where.** The site's organization page gets a *Requests* card: requests to me (pay, decline) and mine (cancel), plus *Ask for coins*. In Slack:
- `/kudos request @bruno 2 reason` asks;
- `/kudos requests` lists requests to you and yours, only to you;
- `/kudos request pay #3`, `/kudos request decline #3`, `/kudos request cancel #3`.

### Nudges

When announcements are on, a claim and a request are posted in the channel where they were made, naming both people ("@bruno says he did bounty #7 from @ana"; "@ana asks @bruno for 2 coins: reviewed your PR"). That is the nudge, and it needs no new Slack permission. A direct message would need `chat:write` and stays for later. With announcements off, only the one who typed sees the answer, and the other person finds it on the site or in `/kudos requests` and `/kudos bounties`.

Words in Slack, also understood in Portuguese and Spanish: `done`/`feito`/`hecho`, `reject`/`recusar`/`rechazar`, `request`/`pedido`/`pedir`, `decline`/`recusar`/`rechazar`.

## Consequences

- Neither claims nor requests create coins: a paid claim spends what the offer set aside, and a paid request is a give.
- The hourly job does one more query an hour. The collection-group query on `autoPayAt` needs a single-field index override in `firebase/firestore.indexes.json`.
- Members read requests like the ledger. A request names two members, and everyone in the organization sees it, as they see gives.
- Deleting an account clears the name on requests as on the ledger; open requests to or from someone who left can only be cancelled or declined.
- Fines and the pot come after this, in their own decision.

## Code

- `worker/src/services/bounties.ts` (claims, rejection, paying by itself)
- `worker/src/services/requests.ts`
- `worker/src/scheduled.ts` (bounties due)
- `worker/src/slack/` (the new commands)
- `firebase/firestore.rules`, `firebase/firestore.indexes.json`
- `web/src/features/org/` (*I did it*, the *Requests* card)
