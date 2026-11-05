# Portuguese, English and Spanish

**Status:** proposed

## Context

Kudocoin is for groups in Brazil, Latin America and elsewhere, and one organization may mix languages. A text missing in one language is a broken screen.

## Decision

**Every word on screen goes through `t()`.** The keys live in `web/src/i18n/locales/pt-BR.ts`, `en.ts` and `es.ts`. The English and Spanish files are typed by the Portuguese one, so a key missing or extra in either does not compile, and tests check that no value is empty and that the placeholders match.

**Choosing the language.** The first visit follows the browser (Portuguese for any `pt`, Spanish for any `es`, English for everything else). A switch in the header changes it, and the choice is kept in the browser and, once signed in, in the person's profile, so it follows them to another device.

**What is not translated:** what people write. Organization names, the coin's name, reasons and the prize stay as typed.

**Numbers and dates** use `Intl` with the chosen language: `1.250` and `5 de nov.` in Portuguese, `1,250` and `Nov 5` in English, `1250` and `5 nov` in Spanish.

**The API speaks codes, not sentences.** The Worker answers a refused give with a code (`allowance_exceeded`), and the web app turns it into words.

## Consequences

- Adding another language is one more locale file typed by `Messages`, one more code in `LANGS`, and the same code in the Worker's list.
- The public page at `/` has every language, at `/` (following the browser) and with `?lang=pt`, `?lang=en` or `?lang=es` to share a link in one of them.

## Code

- `web/src/i18n/`
- `worker/src/errors.ts`
