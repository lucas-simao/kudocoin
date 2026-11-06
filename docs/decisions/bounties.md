# Bounties

**Status:** proposed

## Context

A give thanks someone after they helped. Sometimes the help is wanted first: "3 coins to whoever fixes the flaky test". That turns coins into a reason to pick up the chores nobody claims, and it fits the game only if it follows its rules: coins come from the daily allowance, nobody pays themselves, and nothing is ever taken from a balance.

## Decision

**A bounty** is an open offer: a task in words, an amount, who offered it, and a number in its organization (`#7`), so Slack can name it. It lives in `orgs/{orgId}/bounties/{id}` with its status: `open`, `paid` or `cancelled`.

**Offering** spends the allowance at once, as a give would: the amount follows the same rules (`allowance-and-limits.md`: at most `maxPerGive`, at most what is left today), and counts in the offerer's given today. The task is required, up to 280 characters. A member has at most 3 open bounties, so the list stays short; the count is kept on the member, in the same transaction.

**Paying.** The one who offered it, or an admin if that person left, picks who did the task: any other member. That writes one ledger entry of a new kind, `bounty`, from the offerer to that member, with the task as its reason, in the season open at that moment (`ledger.md`). It does not count against the offerer's allowance again (it was counted when offered), nor against the receiver's daily limit, as an award does not. The bounty becomes `paid`, with who and when.

**Cancelling.** The offerer or an admin can cancel an open bounty. Cancelled the same day it was offered, the allowance comes back; on a later day there is nothing to give back, because a day's allowance does not carry over anyway.

**Expiring.** A bounty is open for 30 days. After that it shows as expired and cannot be paid, only cancelled: no job is needed, the date is checked when it is shown or paid.

**Where.** On the organization's page, a *Bounties* card lists the open ones (task, amount, who, days left), with *Pay* and *Cancel* for the offerer and admins, and *Offer a bounty* for everyone. Paid ones appear in the recent activity: "Ana paid 3 Devcoin to Bruno for: fix the deploy". In Slack:
- `/kudos bounty 3 fix the flaky test` offers one, announced in the channel when announcements are on;
- `/kudos bounties` lists the open ones, only to the one who asked;
- `/kudos bounty pay #7 @bruno` and `/kudos bounty cancel #7`.

## Consequences

- Bounties are a way to spend the allowance, not new coins: nobody can create coins with them.
- Seasons do not touch open bounties: one offered in a sprint and paid in the next pays into the next.
- Removing a member or deleting an account leaves their open bounties for an admin to pay or cancel; their name is cleared like in the ledger.
- Members read bounties as they read the ledger; the Worker writes them, as it writes everything (`organizations.md`).
- Requests and fines come next, in their own decisions.

## Code

- `worker/src/services/bounties.ts`
- `worker/src/services/give.ts` (the `bounty` entry)
- `worker/src/slack/command.ts`, `parse.ts`, `messages.ts`
- `firebase/firestore.rules` (`bounties/` readable by members)
- `web/src/features/org/` (the *Bounties* card)
