# Decisions

One file per subject, shaped by [_template.md](_template.md).

| Decision | About |
|---|---|
| [zero-cost-hosting.md](zero-cost-hosting.md) | Firebase Spark for sign-in and the database, Cloudflare free for the API and the web app, no card anywhere |
| [organizations.md](organizations.md) | One database for every organization, `/o/<slug>`, two locks against one reading another |
| [ledger.md](ledger.md) | An append-only ledger, balances and the leaderboard kept beside it, one transaction per movement |
| [allowance-and-limits.md](allowance-and-limits.md) | Daily allowance, most per give, most received per day, the order the Worker checks them |
| [sign-in.md](sign-in.md) | GitHub and Google through Firebase, the Worker trusting only the ID token, what we keep about a person |
| [languages.md](languages.md) | Portuguese and English on every screen, typed keys, what is never translated |
| [seasons.md](seasons.md) | One open season, closed by an admin on the day the group meets |
| [invites.md](invites.md) | One active invite link per organization, stored only as a hash |
| [slack.md](slack.md) | One Slack app for every workspace, linking each person once, `/kudos` under the same rules as the web app |
| [sprints.md](sprints.md) | Seasons by hand or every sprint of 1–4 weeks, closed by an hourly job |
| [bounties.md](bounties.md) | Coins offered for a task from the allowance, paid to whoever did it |
