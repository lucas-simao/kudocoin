# Kudocoin

[![CI](https://github.com/lucas-simao/kudocoin/actions/workflows/ci.yml/badge.svg)](https://github.com/lucas-simao/kudocoin/actions/workflows/ci.yml)
[![Deploy](https://github.com/lucas-simao/kudocoin/actions/workflows/deploy.yml/badge.svg)](https://github.com/lucas-simao/kudocoin/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[Jogue agora em kudocoin.pages.dev →](https://kudocoin.pages.dev/?lang=pt)** Grátis, nada para instalar.

[Read in English](README.md)

Uma moeda de brincadeira para times. Dê moedas para agradecer uma review, uma correção ou uma resposta na hora certa. Cada grupo tem o seu placar e, no dia que escolher, fecha a temporada e dá um prêmio para quem tiver mais.

Gratuito e de código aberto. Um servidor público atende todo mundo: entre com GitHub ou Google, crie a sua organização (uma empresa, um time, um grupo de amigos), defina as regras e compartilhe o link de convite. Nada para instalar ou hospedar.

> A moeda não vale dinheiro. Não se compra, não se vende, não se saca. O prêmio é o que o seu grupo combinar.

## Como um grupo joga

1. Crie uma organização e defina as regras: o nome da moeda, quantas cada membro pode dar por dia, o máximo numa doação, quanto uma pessoa pode receber por dia, quando a temporada termina e qual é o prêmio.
2. Compartilhe o link de convite no chat do grupo.
3. Dê moedas com um motivo: "revisou meu PR às 23h". A sua cota do dia aparece enquanto você doa. Com o Slack ligado, `/kudos @ana 2 revisou meu PR` faz o mesmo sem sair da conversa.
4. Acompanhe o placar. No último dia, um admin fecha a temporada, a classificação final fica guardada e todo mundo recomeça do zero.

Em português, inglês e espanhol.

## Estrutura

| Pasta | O que mora ali |
| --- | --- |
| `worker/` | A API, um Cloudflare Worker em TypeScript: checagem do login, regras da organização, o livro de lançamentos. |
| `web/` | O app e a página pública, React com Vite. |
| `firebase/` | Regras e índices do Firestore e a configuração dos emuladores. |
| `brand/` | Tema e logo. |
| `docs/` | O produto ([product.md](docs/product.md)), a primeira versão ([mvp.md](docs/mvp.md)) e as [decisões](docs/decisions/). |

Roda nos planos gratuitos do Firebase (login e Firestore) e da Cloudflare (Workers e Pages), sem cartão cadastrado: [docs/decisions/zero-cost-hosting.md](docs/decisions/zero-cost-hosting.md).

## Rodar

`make install` e depois `make dev` sobem os emuladores do Firebase, o Worker e o app, sem conta em nuvem nenhuma (os emuladores precisam do Java 21). `make test` roda os testes. A publicação é configurada uma vez, como diz [docs/deploy.md](docs/deploy.md), e depois acontece a cada merge na `main`.

## Licença

MIT, veja [LICENSE](LICENSE).
