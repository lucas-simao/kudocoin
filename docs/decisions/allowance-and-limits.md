# Allowance and limits

**Status:** proposed

## Context

If coins were free to give, two friends would trade them all day and win. The game is fun only when coins are scarce and each one says something.

## Decision

Each organization sets its numbers (`docs/product.md`). The Worker checks, on every give, in this order, and answers with the first rule that fails:

1. The receiver is another member of the same organization. Never oneself.
2. The amount is a whole number from 1 to the organization's "most per give".
3. A reason is present when the organization requires one, at most 280 characters.
4. What the giver already gave today plus this amount is within the daily allowance.
5. What the receiver already received today plus this amount is within "most received per day".
6. The season is open.

**A day** starts at midnight in the organization's time zone. A member's "given today" and "received today" carry the date they belong to, and a give on a new date starts them from zero, so no job is needed to reset them.

**Awards** from admins skip rules 4 and 5 but still need a reason, and appear in the history as awards.

**Requests.** The Worker refuses more than 30 gives a minute from one person, whatever the organization allows, to keep a script from spending the free quota.

## Consequences

- The allowance is a use-it-or-lose-it budget: unused coins do not accumulate. That keeps every day's choices small.
- Changing the numbers mid-season applies from the next give; nothing already given changes.

## Code

- `worker/src/services/rules.ts` (pure functions, unit tested)
- `worker/src/services/give.ts`
