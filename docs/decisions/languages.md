# Portuguese and English

**Status:** proposed

## Context

Kudocoin is for groups in Brazil and elsewhere, and one organization may mix both. A text missing in one language is a broken screen.

## Decision

**Every word on screen goes through `t()`.** The keys live in `web/src/i18n/locales/pt-BR.ts` and `web/src/i18n/locales/en.ts`. The English file is typed by the Portuguese one, so a key missing or extra in English does not compile, and a test checks that no value is empty in either.

**Choosing the language.** The first visit follows the browser (Portuguese for any `pt`, English for everything else). A switch in the header changes it, and the choice is kept in the browser and, once signed in, in the person's profile, so it follows them to another device.

**What is not translated:** what people write. Organization names, the coin's name, reasons and the prize stay as typed.

**Numbers and dates** use `Intl` with the chosen language: `1.250` and `5 de nov.` in Portuguese, `1,250` and `Nov 5` in English.

**The API speaks codes, not sentences.** The Worker answers a refused give with a code (`allowance_exceeded`), and the web app turns it into words.

## Consequences

- Adding Spanish later is one more locale file and one more option in the switch.
- The public page at `/` has both languages, at `/` (following the browser) and with `?lang=pt` or `?lang=en` to share a link in one of them.

## Code

- `web/src/i18n/`
- `worker/src/errors.ts`
