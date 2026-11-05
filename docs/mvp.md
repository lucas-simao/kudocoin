# First release

The first release is the smallest thing a group can play with for a whole season.

## In

- Sign in with GitHub or Google, sign out, delete my account.
- Create an organization with its settings (`docs/product.md`), see the organizations I belong to.
- Invite link: create, copy, turn off, make a new one. Joining through it.
- Give coins: pick a member, an amount, a reason. The screen shows what is left of today's allowance.
- Leaderboard of the current season, with each member's balance and the prize.
- A member's page: what they received and gave, with reasons.
- Admin: change settings, remove a member, make someone admin, award coins, close the season.
- Past seasons: the final standings, read only.
- Portuguese, English and Spanish, with a switch in the header.
- A public page at `/` that explains Kudocoin in every language.

## Out, on purpose

- GitHub awards for pull requests and reviews (next, `docs/decisions/github-awards.md` when it is written).
- Slack and Discord bots.
- Email or push notifications.
- Custom domains per organization.
- Anything paid.

## Done means

- A new person can sign in, create an organization, invite a friend, and give them coins in under two minutes.
- One organization never sees another's members, gives or settings.
- A member cannot give more than the allowance, give to themselves, or write a balance from the browser, and the tests prove it.
- Every screen reads the same in every language, and a test fails when a key is missing in one of them.
