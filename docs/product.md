# Kudocoin

A playful coin for teams. People give each other coins to say thanks for a review, a fix, an answer at the right time. Each group keeps a leaderboard, and on a day it picks, it closes the season and gives a prize to whoever has the most.

Kudocoin is free and open source, and one public server runs it for everyone. A company, a team or a group of friends signs in, creates its organization, sets its own rules and invites its people. Nobody installs or hosts anything.

## Who it is for

- Developer teams inside a company.
- Teams that cross companies (an agency and its client, an open source project).
- Friends who code together and want a reason to brag once a year.

## Rules that do not change

- **A coin has no money value.** It cannot be bought, sold, transferred out or cashed. The prize is whatever the group decides among itself; Kudocoin never handles it.
- **Nobody gives coins to themselves.** Every give names another member.
- **The ledger only grows.** A give is never edited or deleted. A mistake is fixed by a new entry that says why.
- **Only the server writes coins.** The browser asks; the server checks the organization's rules and writes. See `docs/decisions/ledger.md`.
- **It costs nothing to run.** Everything fits the free plans of Firebase and Cloudflare, with no card on file. A feature that needs a paid plan waits. See `docs/decisions/zero-cost-hosting.md`.
- **Three languages, always.** Every word on screen exists in Brazilian Portuguese, English and Spanish. See `docs/decisions/languages.md`.

## How it works

1. Someone signs in with GitHub or Google and creates an organization: a name, an address (`/o/<slug>`) and the rules.
2. They share an invite link. Whoever opens it and signs in becomes a member.
3. Every member gets a daily allowance of coins to give. Giving names a person, an amount and a reason ("reviewed my PR at 11 pm").
4. The leaderboard shows the season's balances, and each person's page shows what they received and why.
5. On the season's last day, an admin closes it: the final standings are kept, and balances start again from zero.

## What an organization sets

| Setting | What it means | Default |
| --- | --- | --- |
| Coin name | What the group calls its coin ("kudos", "devcoins", "🍪") | Kudocoin |
| Daily allowance | Coins each member can give per day | 5 |
| Most per give | The largest single give | 5 |
| Most received per day | Caps how much one person can receive in a day, so a pair cannot farm | 20 |
| Reason required | A give needs a reason | Yes |
| Time zone | When "a day" starts and ends | The creator's |
| Season end | The day the season closes | 31 December |
| Prize | Free text shown on the leaderboard | Empty |

## Roles

- **Owner**: created the organization. Everything an admin does, plus deleting the organization and handing over ownership.
- **Admin**: changes the settings, manages invites, removes members, awards coins (for a PR, an event, a talk), and closes the season.
- **Member**: gives coins, sees the leaderboard and the history.

## Later

GitHub awards: an organization links its repositories, and merged pull requests and reviews earn coins on their own. See `docs/mvp.md` for what ships first.
