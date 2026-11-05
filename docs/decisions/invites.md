# Invite links

**Status:** proposed

## Context

A group grows by sharing a link in its chat, and an admin needs to find the link again to share it with the next person. Anyone holding the link can join, so it must be easy to turn off.

## Decision

An admin creates an invite link: `/join/<token>`, where the token is 24 random bytes in base64url. Joining looks the link up by the token's SHA-256, under `invites/{hash}`, which holds the organization, who made it, and when. The token itself is kept in `orgs/{orgId}/admin/invite`, which only the organization's admins can read, so they can copy the link again.

Opening the link asks to sign in, shows the organization's name, and joins on a click.

An organization has at most one active link. "New link" turns the old one off. "Turn off" leaves none.

## Consequences

- No client can list `invites/`: a link works only for whoever holds it.
- A removed member can come back through a link that is still active; making a new link is the answer.

## Code

- `worker/src/services/invites.ts`
- `firebase/firestore.rules`
