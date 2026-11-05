# Invite links

**Status:** proposed

## Context

A group grows by sharing a link in its chat. Anyone holding the link can join, so it must be easy to turn off.

## Decision

An admin creates an invite link: `/join/<token>`, where the token is 24 random bytes in base64url. Firestore keeps only its SHA-256, under `invites/{hash}`, with the organization, who made it, and an optional expiry. Opening the link asks to sign in, shows the organization's name and joins on a click.

An organization has at most one active link. "New link" turns the old one off. "Turn off" leaves none.

## Consequences

- A leaked database copy holds no working invite.
- A removed member can come back through a link that is still active; turning the link off is the answer.

## Code

- `worker/src/services/invites.ts`
