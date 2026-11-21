# Repository guidance

- Next.js App Router code is under `src/app`; recipe behavior and Supabase adapters are under `src/lib`.
- Household privacy is enforced by PostgreSQL row-level security. Changes to data access must preserve the policies in `supabase/migrations/` and the isolation test in `supabase/tests/database/`.
- Recipe URL imports must go through `src/lib/safe-page-fetcher.ts`; keep its public-address and redirect validation in place.
- Local Supabase requires Docker. Copy `.env.example` to `.env.local`, start the database with `npm run db:start`, and get local keys with `npm run db:status`.
- Run focused tests with `npm test -- src/lib/<name>.test.ts`; then `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues; use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.
