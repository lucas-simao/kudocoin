# Seasons

**Status:** proposed

## Context

The point of the game is the day the group meets and someone wins. After that, everyone should start even again, while the past stays visible.

## Decision

An organization always has one open season, created with the organization. It has an end date (by default 31 December) and a prize (free text).

**Closing** is an admin's button, offered from the end date on. It copies the leaderboard into the season as its final standings, marks it closed, and opens the next season with every balance at zero. By default nothing closes on its own: the group closes it on the day it meets. An organization can instead have seasons that follow its sprints and close by themselves (`sprints.md`).

After the end date and before an admin closes it, gives still work, and the leaderboard shows "Season ended, waiting for an admin to close it".

## Consequences

- Past seasons are read only, listed under the leaderboard.
- The ledger keeps every entry of every season; balances are per season.

## Code

- `worker/src/services/seasons.ts`
