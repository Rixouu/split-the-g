# Migration Timestamp Policy

- Migrations are forward-only. Do not rewrite history.
- Do not rename already committed migration files.
- Every new migration must use a unique UTC timestamp prefix.
- If a migration needs correction, create a new migration file with a newer unique timestamp.

## Historical Note

This repository contains two historical migrations that share the same timestamp prefix:

- `20260328220000_competition_scores_realtime.sql`
- `20260328220000_public_profiles_nickname.sql`

They are intentionally preserved as-is. Any future corrections must be implemented by new forward migrations.
