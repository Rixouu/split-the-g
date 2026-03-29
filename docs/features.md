# Features

This document maps product areas to routes and data concepts. It is not an exhaustive UI spec.

## Pour & score

| Area | Route(s) | Notes |
| ---- | -------- | ----- |
| Home / new split | `/` | Primary capture and scoring entry |
| Pour result | `/pour/:pourRef` | Shareable card; claim, bar name (Places), competition hooks |
| Legacy redirect | `/score/:splitId` | Redirects to pour URL |

## Identity & profile

| Area | Route | Notes |
| ---- | ----- | ----- |
| Profile | `/profile` | Google sign-in, `public_profiles` (display name, nickname), favorites, friends, progress tabs |
| Email on score | `POST /api/email` | Optional competition/email capture tied to session + score |

**Nickname vs leaderboard:** `public_profiles.nickname` is optional and unique (case-insensitive). `scores.username` is what feeds and boards display; saving the profile syncs it from nickname or full name, including a case-insensitive match path for `scores.email`.

## Social & discovery

| Area | Route(s) | Notes |
| ---- | -------- | ----- |
| Feed | `/feed` | Activity-style listing |
| Wall / collage | `/wall`, `/collage` | Visual layouts of submissions |
| Pubs | `/pubs` | Pub-oriented exploration |
| Leaderboards | `/leaderboard`, `/countryleaderboard`, `/past24hrleaderboard` | Different scopes and time windows |
| FAQ | `/faq` | Product help |

## Friends

- **Invites:** Insert into `friend_requests` with `from_email` / `to_email`; optional **Resend** email via `POST /api/friend-invite`.
- **Accept / decline:** Updates request status; accept creates symmetric `user_friends` rows.
- **Comparison:** Profile loads scores for the user and accepted friends’ emails to build range-filtered mini leaderboards.

## Competitions

| Area | Route(s) | Notes |
| ---- | -------- | ----- |
| List & create | `/competitions` | Create, edit (owner), join/leave, email invites, add accepted friends as participants |
| Detail | `/competitions/:competitionId` | Countdown, leaderboard, submit linked or new split |

**Invites:** `competition_invites` stores invited emails. New users who sign up with that email see pending context in the UI; joining is still an explicit action (not auto-join).

## Navigation

- **AppNavigation** provides desktop header pills and a mobile dock (Pour FAB, Feed, Compete, Pubs, Me + secondary Wall / Leaderboard).
