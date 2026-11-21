# RecipeRepo

A shared household cookbook: save a recipe from a webpage, review the clean copy, and find it by name when it is time to cook.

## Local development

Requirements: Node.js 20.9+ and Docker Desktop.

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:start
npm run db:status
```

Copy `API_URL` and `ANON_KEY` from `npm run db:status` into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

Then start the app:

```powershell
npm run dev
```

Open <http://localhost:3000>, create an account, and create a household. Invite links are private, expire after seven days, and can be accepted after signing in or creating an account.

## Database

The local Supabase project applies migrations from `supabase/migrations/`. To rebuild the local database and run its migrations:

```powershell
npm run db:reset
```

Household membership and recipe access are protected by row-level security. Keep the isolation test passing when changing those policies:

```powershell
npm run db:test
```

## Verification

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Recipe extraction uses Schema.org `Recipe` JSON-LD when available. Pages without structured recipe data can still be saved by manually completing the title, ingredients, and method. Page fetching is restricted to public HTTP(S) destinations.
