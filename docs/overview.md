# Overview

**Split The G** is a web app for scoring how well a pint’s foam line crosses the Guinness “G”, sharing results, and competing socially.

## Audience

- Casual players who pour once and share a score card.
- Returning users who claim scores with Google, set a display name or nickname, and appear on leaderboards.
- Groups who run **competitions** (public or private) and invite others by email.

## Core flows

1. **Pour & score** — User captures or uploads imagery; the app runs scoring and lands on a pour result URL (`/pour/:pourRef`).
2. **Claim** — Optional Google sign-in links `scores.email` to the account for history and profile features.
3. **Profile** — Display name, optional nickname (leaderboard), favorites (Google Places), friends (requests + list), progress stats, and friend comparison ranges.
4. **Social** — Feed, wall/collage views, global and scoped leaderboards.
5. **Competitions** — Create/join/leave, invite by email, submit scores into a competition window.

## Credits

Product and engineering revamp led by **Jonathan Rycx** ([GitHub](https://github.com/Rixouu)).
