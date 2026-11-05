# Giving coins from Slack

**Status:** proposed

## Context

Most teams that would play live in Slack. Opening another site to say thanks is a step many will skip, so a give should be possible where the thanks happens. Slack apps are free, can be installed by any workspace without a listing in Slack's directory, and fit the Worker's free plan: a slash command is one request answered in under three seconds. Whatever comes from Slack must follow the same rules as the web app (`docs/decisions/allowance-and-limits.md`), and nobody may give in someone else's name.

## Decision

**One public Slack app, "Kudocoin"**, described by `slack/manifest.json`, so it can be created again from the file. Its requests reach the Worker at `/slack/*`.

**A workspace belongs to one organization.** An admin clicks *Add to Slack* in the organization's settings. Slack's OAuth sends them back to `/slack/oauth` with a code and a `state` the Worker signed (the organization, the admin, ten minutes of life). The Worker exchanges the code, then keeps:
- `slackTeams/{teamId}`: which organization the workspace plays in. Only the Worker reads it.
- `orgs/{orgId}/admin/slack`: the workspace's name and the bot token, sealed with AES-GCM under the Worker secret `SLACK_KEY`, so a copy of the database holds no usable token. Admins see the workspace's name; nobody sees the token.

*Disconnect* revokes the token and removes both documents.

**A person is linked once.** The first `/kudos` from someone Slack has not seen answers only to them: "Connect your Kudocoin account", with a button to `/slack/link?t=<token>`. The token is signed by the Worker, names the workspace and the Slack user, and lasts fifteen minutes. On that page they sign in with GitHub or Google; the web app sends the token to the Worker, which checks the signature, the expiry, and that the person is a member of the workspace's organization, and writes `slackUsers/{teamId}_{slackUserId}` → `{ uid }`. A Slack account links to one Kudocoin account; linking again replaces it. A member unlinks from their account page.

**`/kudos @person [amount] [reason]`.** The command is set to escape mentions, so the person arrives as `<@U123|name>`. The amount is a whole number and defaults to 1; the rest is the reason. The Worker:
1. checks Slack's signature (`X-Slack-Signature`, HMAC-SHA256 with the signing secret) and that the timestamp is within five minutes, and refuses anything else;
2. finds the organization from the workspace, and the giver and the receiver from their links;
3. runs the same `move()` as the web app, with an idempotency key made from the request (`docs/decisions/ledger.md`), so a retry from Slack never gives twice.

An unlinked receiver gets nothing yet; the giver is told that this person still has to connect, and nothing is spent.

**Answers.** A refusal answers only the giver, in words ("You can only give 2 more today"). A give is announced in the channel where it was typed: "@ana gave 3 kudos to @bruno: reviewed my PR". An organization can turn the announcement off, and then only the giver sees the confirmation. Texts follow the giver's language in Kudocoin (Portuguese, English or Spanish); the Worker keeps the few Slack sentences in `worker/src/slack/messages.ts`, typed so every language has every sentence.

**Scopes**, the fewest that do this: `commands` (the slash command), `chat:write` (answers and announcements), `users:read` (names for the confirmation). Nothing reads messages or channels.

**Secrets in the Worker**: `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` and `SLACK_KEY`; the client ID is a plain variable. The deploy sets them from GitHub secrets, as it does for Firebase.

## Consequences

- A workspace can play in one organization. A company with two teams in one Slack makes one organization, or waits for channel-to-organization mapping later.
- The free Slack plan limits a workspace to ten apps; Kudocoin is one of them.
- Linking adds a step the first time, and it is the step that keeps anyone from giving as someone else. Matching by email would skip it, but would need reading every member's email and trusting that Slack and the sign-in provider agree.
- Later, on the same pieces: the 🪙 reaction (needs `reactions:read` and the Events API), the weekly leaderboard in a channel, the app's Home tab with the balance, and Discord with the same shape.

## Code

- `slack/manifest.json`
- `worker/src/slack/` (signature, OAuth, command, messages)
- `worker/src/services/give.ts` (the same `move()`)
- `web/src/features/settings/` (Add to Slack, Disconnect, announcements)
- `web/src/features/slack/` (the link page)
- `firebase/firestore.rules` (`slackTeams/` and `slackUsers/` closed to clients)
