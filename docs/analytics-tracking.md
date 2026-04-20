# Analytics Tracking QA

## Environment variables

- `VITE_GA_MEASUREMENT_ID`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST` (optional, defaults to `https://us.i.posthog.com`)

## Consent and initialization checks

1. Open the app in a fresh browser profile.
2. Confirm the consent banner appears once.
3. Click `Reject` and verify no GA/PostHog requests are sent.
4. Open profile account settings, enable analytics, and verify requests begin.
5. Refresh and verify preference persists.

## Event parity checks (GA4 + PostHog)

- `page_view` emitted on each client-side route navigation.
- Home funnel:
  - `pour_capture_started`
  - `pour_submitted`
  - `pour_saved`
  - `pour_processing_failed` (use an invalid image to force)
- Score funnel:
  - `pour_claim_started`
  - `pour_claim_succeeded` / `pour_claim_failed`
  - `venue_details_saved`
  - `competition_attach_succeeded` / `competition_attach_failed`
- Competition:
  - `competition_joined`
  - `competition_left`
  - `competition_created`
- Auth/profile:
  - `auth_google_signin_started`
  - `auth_google_signin_succeeded` / `auth_google_signin_failed`
  - `auth_user_signed_in` (successful auth session for Google sign-in callback)
  - `auth_user_registered` (new account created and first sign-in window)
  - `profile_saved`

## Attribution checks

- Visit with `?utm_source=test&utm_medium=cpc&utm_campaign=spring`.
- Verify first-touch and last-touch fields are present on `page_view`.
- Complete a funnel event and verify attribution fields are attached.

## Registration tracking checks

- Complete a brand-new Google sign-up/sign-in flow.
- Verify `auth_user_signed_in` fires with `isNewUser=true`.
- Verify `auth_user_registered` fires exactly once for that user.
- Sign out and sign back in with the same account; verify `auth_user_registered` does not repeat.
- Verify subsequent sign-ins fire `auth_user_signed_in` with `isNewUser=false`.

## Starter dashboards

- **Funnel:** `pour_capture_started -> pour_submitted -> pour_saved`
- **Reliability:** `pour_processing_failed` grouped by `code`
- **Activation:** distinct users with `pour_saved` by day
- **New users:** count of `auth_user_registered` by day/week
- **Returning sign-ins:** count of `auth_user_signed_in` where `isNewUser=false`
- **New vs returning ratio:** `auth_user_registered / auth_user_signed_in`
- **Competition engagement:** `competition_joined` + `competition_created` by week

## PostHog prebuilt spec

- Use `docs/posthog-insights.spec.json` as your one-file blueprint for creating insights in PostHog.
- It includes:
  - Pour conversion funnel
  - Failure trends by error code
  - New user registrations
  - Returning sign-ins
  - New vs returning sign-ins comparison
  - Competition engagement trends
- Recommended workflow:
  1. Create a dashboard named `Split the G Product Analytics`.
  2. Create each insight from the spec entries under `insights`.
  3. Pin insights using the `dashboard.tileOrder` sequence.
