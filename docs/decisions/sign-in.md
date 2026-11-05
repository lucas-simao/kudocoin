# Signing in with GitHub or Google

**Status:** proposed

## Context

Kudocoin should hold no passwords: fewer things to protect, nothing to reset. Its people are developers, who all have GitHub, and teams that live in Google Workspace.

## Decision

**Firebase Authentication** with two providers, GitHub and Google, in a popup on desktop and a redirect on phones. One person signing in with both, under the same email, is one account (Firebase links them).

**The Worker trusts only the Firebase ID token.** Every API request carries it as `Authorization: Bearer`. The Worker checks its signature against Google's published keys, the issuer and audience of our Firebase project, and that it has not expired, then takes the user id from it. A request without a valid token gets 401.

**What we keep about a person**, in `users/{uid}`: the display name, the picture's URL, the GitHub login when they signed in with GitHub, and the chosen language. Not the email, which Firebase already holds for sign-in and Kudocoin never shows or sends.

**Deleting an account** removes the person from every organization, replaces their name in past ledger entries with "Former member", and deletes their Firebase user. The ledger's amounts stay, so the other members' balances still add up.

## Consequences

- Adding a provider later (Microsoft, email link) is a Firebase setting and a button.
- The GitHub login kept now is what the future GitHub awards match pull requests against.

## Code

- `worker/src/auth/firebase-token.ts`
- `web/src/auth/`
