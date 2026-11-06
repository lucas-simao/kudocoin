# Seasons that follow the sprint

**Status:** proposed

## Context

Today a season ends on a date and waits for an admin to close it (`seasons.md`). Teams that play along their work live in sprints of one to four weeks: someone has to remember to close every two weeks, and the day after a sprint ends the leaderboard still shows the old one. Groups of friends, on the other hand, close once a year at a party, and closing by hand suits them. Both have to keep working, and everything stays on free plans.

## Decision

**An organization picks how its seasons end**, in Settings:
- **By hand**, as today: one end date, and an admin closes the season on the day the group meets.
- **Every sprint**: a length of 1, 2, 3 or 4 weeks. Each season starts the day after the previous one ends and lasts exactly that long, so the dates never drift.

Switching to sprints, the admin picks when the current season ends (today or later); from then on the next ones follow by themselves. Switching back to *by hand* keeps the current season's end date and stops there.

**A season knows its first day.** It gets `startsOn` (YYYY-MM-DD in the organization's time zone) beside `endsOn`. Seasons created before this read their first day from `startedAt`.

**Closing by itself.** A season closes after its last day ends in the organization's time zone. The organization keeps that instant as `closesAt`, which is written whenever the season, its end date or the sprint length changes; *by hand* leaves it empty. Once an hour, a Cloudflare Cron Trigger asks Firestore for the organizations whose `closesAt` has passed (`closesAt <= now`, at most 50 at a time) and closes each one with the same `closeSeason()` as the button, in its own transaction. The next season starts the day after the old one's end, not the day the job ran, and keeps the same prize unless an admin changes it. A season already closed is skipped, so a job that runs twice or late does no harm.

**Between the end and the job** (an hour at most), gives still count in the season that is ending, as they do today while it waits for an admin.

**An admin can still close by hand** from the last day on, in either mode; the sprint that follows starts the next day.

**Words.** In sprint mode the app says "Sprint 12" where it says "Season 12" today, and shows its dates ("3 – 16 Nov"). Past sprints stay listed under the leaderboard, with their podium.

## Consequences

- Nobody has to remember to close a sprint, and the leaderboard is fresh on its first morning.
- The hourly job costs one Firestore query an hour, plus the writes of the seasons it closes: well inside the free plan, as is one Cron Trigger.
- The Firestore client gains range queries (`<=`) beside equality; `closesAt` is a single field, so Firestore indexes it on its own.
- Announcing the winner in Slack when a sprint closes needs the `chat:write` scope and a chosen channel, so it is its own step later (`slack.md`). Until then the result shows on the site and in `/kudos summary`.
- Bounties, requests and fines come after this, in their own decisions, and count per season like everything else.

## Code

- `worker/src/services/seasons.ts` (`closeSeason`, the next season's dates, `closesAt`)
- `worker/src/services/orgs.ts` (the cadence setting)
- `worker/src/scheduled.ts` (the hourly job)
- `worker/src/firestore/client.ts` (range queries)
- `worker/wrangler.toml` (`[triggers] crons`)
- `web/src/features/settings/` (how seasons end) and `web/src/features/org/` (sprint name and dates)
