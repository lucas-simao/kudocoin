# Giving coins from Slack

**Status:** accepted

## Context

Most teams that would play live in Slack. Opening another site to say thanks is a step many will skip, so a give should be possible where the thanks happens. Slack apps are free, can be installed by any workspace without a listing in Slack's directory, and fit the Worker's free plan: a slash command is one request answered in under three seconds. Whatever comes from Slack must follow the same rules as the web app (`docs/decisions/allowance-and-limits.md`), and nobody may give in someone else's name.

## Decision

**One public Slack app, "Kudocoin"**, described by `slack/manifest.json`, so it can be created again from the file. Its requests reach the Worker at `/slack/*`.

**A workspace belongs to one organization.** An admin clicks *Add to Slack* in the organization's settings. Slack's OAuth sends them back to `/slack/oauth` with a code and a `state` the Worker signed (the organization, the admin, ten minutes of life). The Worker exchanges the code, then keeps:
- `slackTeams/{teamId}`: which organization the workspace plays in, the language of the admin who connected it, and the workspace's token, sealed with AES-GCM under a key derived from the Worker secret `SLACK_KEY`, so a copy of the database holds no usable token. Only the Worker reads it.
- `slack` on the organization: the workspace's id and name, and whether gives are announced. Members see the name.

*Disconnect* revokes the token, removes the workspace's document and clears `slack`. People's links stay, and work again if the same workspace connects again.

**A person is linked once.** The first `/kudos` from someone Slack has not seen answers only to them: "Connect your Kudocoin account", with a button to `/slack/link?t=<token>`. The token is signed by the Worker, names the workspace, the Slack user and their Slack name, and lasts fifteen minutes. On that page they sign in with GitHub or Google and see which Slack account, workspace and organization they are about to link, with a warning to continue only if they just typed `/kudos`: a link passed on by someone else would let that person give as them. Confirming sends the token to the Worker, which checks the signature, the expiry, and that the person is a member of the workspace's organization, and writes `slackUsers/{teamId}_{slackUserId}` → `{ uid }`. A Slack account links to one Kudocoin account; linking again replaces it. A member unlinks from their account page.

**`/kudos @person [amount] [reason]`.** The command is set to escape mentions, so the person arrives as `<@U123|name>`. The amount is a whole number and defaults to 1; the rest is the reason. The Worker:
1. checks Slack's signature (`X-Slack-Signature`, HMAC-SHA256 with the signing secret) and that the timestamp is within five minutes, and refuses anything else;
2. finds the organization from the workspace, and the giver and the receiver from their links;
3. runs the same `move()` as the web app, with an idempotency key made from the command's `trigger_id` (`docs/decisions/ledger.md`), so a retry from Slack never gives twice.

Slack waits three seconds for an answer. The Worker answers at once with nothing, finishes the give in the background (`waitUntil`), and posts the answer to the command's `response_url`, which needs no token and works in any channel, private ones and direct messages included.

An unlinked receiver gets nothing yet; the giver is told that this person still has to connect, and nothing is spent.

**Answers.** A refusal answers only the giver, in words ("You can only give 2 more today"). A give is announced in the channel where it was typed: "@ana gave 3 kudos to @bruno: reviewed my PR". An organization can turn the announcement off, and then only the giver sees the confirmation. The reason is kept as plain words, and posted with Slack's markup escaped, so a reason cannot ping `@channel`. Texts follow the giver's language in Kudocoin (Portuguese, English or Spanish), or the connecting admin's before the giver has one; the Worker keeps the few Slack sentences in `worker/src/slack/messages.ts`, typed so every language has every sentence.

**Scopes**: only `commands`. Answers go through `response_url`, and Slack shows names for mentions on its own, so neither `chat:write` nor `users:read` is needed. Nothing reads messages, channels or people.

**Secrets in the Worker**: `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` and `SLACK_KEY`; the client ID is a plain variable. The deploy sets them from GitHub secrets, as it does for Firebase.

## Consequences

- A workspace can play in one organization. A company with two teams in one Slack makes one organization, or waits for channel-to-organization mapping later.
- The free Slack plan limits a workspace to ten apps; Kudocoin is one of them.
- Linking adds a step the first time, and it is the step that keeps anyone from giving as someone else. Matching by email would skip it, but would need reading every member's email and trusting that Slack and the sign-in provider agree.
- Slack is optional: without its settings the Worker keeps it off and the web app hides it.
- The end-to-end tests run the whole path against a fake Slack (`worker/e2e/fake-slack.ts`).
- Later, on the same pieces: the 🪙 reaction (needs `reactions:read`, `chat:write` and the Events API, and each workspace adds the app again for the new scopes), the weekly leaderboard in a channel, the app's Home tab with the balance, and Discord with the same shape.

## Code

- `slack/manifest.json`
- `worker/src/slack/` (`crypto.ts`, `service.ts`, `command.ts`, `parse.ts`, `messages.ts`)
- `worker/e2e/fake-slack.ts`
- `worker/src/services/give.ts` (the same `move()`)
- `web/src/features/settings/` (Add to Slack, Disconnect, announcements)
- `web/src/features/slack/` (the link page)
- `web/src/features/account/` (the person's links, to unlink)
- `firebase/firestore.rules` (`slackTeams/` and `slackUsers/` closed to clients)
