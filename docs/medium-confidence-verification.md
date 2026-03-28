# Medium-Confidence Candidate Verification

This pass verifies candidates only. No files were deleted in this phase.

## `app/routes/email.tsx`

- Route is still wired in `app/routes.ts` as `route("api/email", "./routes/email.tsx")`.
- API usage is documented in `README.md` and `docs/features.md` as `POST /api/email`.
- Result: keep for now (still part of public route surface).

## `app/manifest.json` and `public/manifest.webmanifest`

- App root links `rel="manifest"` to `/site.webmanifest` in `app/root.tsx`.
- `app/manifest.json` exists but is not linked from `app/root.tsx`.
- `public/manifest.webmanifest` exists but is also not linked from `app/root.tsx`.
- Result: both manifest files are likely stale/duplicated with current `/site.webmanifest` usage; no deletion yet.

## `public/icon0.svg` and `public/app-icon-split-the-g.svg`

- Both files exist in `public/`.
- No direct code references were found in `app/` route/component sources.
- Result: likely optional/manual assets; keep until visual QA confirms they are unused by browser shortcuts, social previews, or external docs.
