# Kudocoin

[![CI](https://github.com/lucas-simao/kudocoin/actions/workflows/ci.yml/badge.svg)](https://github.com/lucas-simao/kudocoin/actions/workflows/ci.yml)
[![Deploy](https://github.com/lucas-simao/kudocoin/actions/workflows/deploy.yml/badge.svg)](https://github.com/lucas-simao/kudocoin/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[Play now at kudocoin.pages.dev →](https://kudocoin.pages.dev/)** Free, nothing to install.

[Leia em português](README.pt-BR.md)

A playful coin for teams. Give coins to say thanks for a review, a fix or an answer at the right time. Each group keeps its leaderboard, and on the day it picks, it closes the season and gives a prize to whoever has the most.

Free and open source. One public server runs it for everyone: sign in with GitHub or Google, create your organization (a company, a team, a group of friends), set its rules, share the invite link. Nothing to install or host.

> A coin has no money value. It cannot be bought, sold or cashed. The prize is whatever your group decides.

## How a group plays

1. Create an organization and set its rules: what the coin is called, how many each member can give a day, the largest single give, how much one person can receive a day, when the season ends and what the prize is.
2. Share the invite link in the group's chat.
3. Give coins with a reason: "reviewed my PR at 11 pm". Your daily allowance is shown as you give.
4. Follow the leaderboard. On the last day, an admin closes the season, the final standings are kept, and everyone starts again from zero.

In Portuguese and English.

## Structure

| Folder | What lives there |
| --- | --- |
| `worker/` | The API, a Cloudflare Worker in TypeScript: sign-in check, the organization's rules, the ledger. |
| `web/` | The app and the public page, React with Vite. |
| `firebase/` | Firestore rules, indexes and the emulator settings. |
| `brand/` | Theme and logo. |
| `docs/` | The product ([product.md](docs/product.md)), the first release ([mvp.md](docs/mvp.md)) and the [decisions](docs/decisions/). |

It runs on the free plans of Firebase (sign-in and Firestore) and Cloudflare (Workers and Pages), with no card on file: [docs/decisions/zero-cost-hosting.md](docs/decisions/zero-cost-hosting.md).

## Run it

`make install`, then `make dev` starts the Firebase emulators, the Worker and the web app, with no cloud account (the emulators need Java 21). `make test` runs the tests. Publishing is set up once, as [docs/deploy.md](docs/deploy.md) says, and then happens on every merge to `main`.

## License

MIT, see [LICENSE](LICENSE).
