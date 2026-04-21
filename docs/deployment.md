# Deployment

## Current Release Posture

Holdfast now has a real production Pages project and a live production hostname.

That does not mean launch quality is finished.

As of April 20, 2026:

- local Cloudflare CLI auth is working
- a disposable validation project exists at `https://holdfast-validation.pages.dev`
- a dedicated staging shell project exists at `https://holdfast-staging.pages.dev`
- a production direct-upload Pages project exists at `https://holdfast-5oz.pages.dev`
- the custom hostname `https://holdfast.xylent.studio` is attached and serving
- hosted shell smoke passes on the production hostname
- provider-backed production auth smoke passes on the production hostname
- same-account hosted sync, attachment download, offline replay, and a common later-offline-edit catch-up path pass on the production hostname

## Chosen Hosting Direction

- frontend hosting: Cloudflare Pages
- source control: GitHub repo `xylent-studio/holdfast`
- production hostname: `holdfast.xylent.studio`
- backend/auth/sync: Supabase

## Deployment Mode Choice

Holdfast is currently hosted on Cloudflare Pages as a direct-upload project.

Current production mode:

- project name: `holdfast`
- project domain: `holdfast-5oz.pages.dev`
- custom hostname: `holdfast.xylent.studio`
- deployment path: Wrangler from this repo

Why this changed:

- the real hostname needed to become live now
- the Cloudflare Git-integration path was not available through the current automation surface
- direct upload is acceptable because GitHub remains the source of truth and the deploy path is scripted in-repo

Important constraint:

- Cloudflare documents that Direct Upload projects cannot switch to Git integration later

That means if Git integration becomes a must-have later, replace the production Pages project intentionally and reattach the custom hostname on purpose.

## Hosted Validation Track

Holdfast still keeps a separate disposable Pages project for hosted smoke:

- validation project: `holdfast-validation`
- validation origin: `https://holdfast-validation.pages.dev`
- current repo command: `npm run cf:pages:validate`

This stays separate from production.

Why:

- it lets the repo exercise risky hosted auth/callback/offline behavior without touching the public hostname
- it keeps a disposable smoke surface available even though production now exists
- it isolates validation runs from the production domain when needed

Before provider-backed hosted auth smoke, run:

- `npm run cf:pages:auth-preflight`

Once that passes, run:

- `npm run cf:pages:auth-smoke`

Rules:

- do not attach `holdfast.xylent.studio` to the validation project
- do not treat the validation project as launch proof by itself
- do not assume validation auth smoke will pass while Supabase Auth URL configuration is pinned to production
- do not treat staging auth as available until a deliberate staging auth lane exists
- keep production release gates tied to trust, not to the existence of a hosted URL

## Staging Shell Track

Holdfast now also has a dedicated Cloudflare staging shell surface:

- staging project: `holdfast-staging`
- staging origin: `https://holdfast-staging.pages.dev`

Current use:

- hosted shell smoke
- service-worker and offline shell checks
- risky UI and release checks that should not touch production

Current limitation:

- provider-backed staging auth is still not real yet
- a second Supabase project or staging auth environment is required before staging can carry auth or sync truth

## Repo Baseline

The repo now includes:

- project-local `wrangler`
- `wrangler.jsonc` for source-controlled Pages configuration
- a repo-local Pages deployment helper at `scripts/pages-validation.mjs`
- npm scripts for validation and production Pages status, deploy, and smoke
- Playwright smoke that can run locally or against a hosted URL
- pinned local Node version files for reproducible builds

## Required Setup For Trustworthy Public Use

### Cloudflare

- authenticate `wrangler`
- confirm the `xylent.studio` zone is accessible in the same Cloudflare account used for Pages
- keep the production and validation projects distinct

### Supabase

- set `VITE_SUPABASE_URL`
- set `VITE_SUPABASE_ANON_KEY`
- enable Google auth
- configure email magic link or OTP fallback
- keep the connected Supabase project aligned with the repo migrations
- add redirect allow-list entries for:
  - `http://localhost:4173/auth/callback`
  - `https://holdfast-validation.pages.dev/auth/callback`
  - `https://holdfast.xylent.studio/auth/callback`
  - preview callback URLs before public preview testing

### Staging auth lane

If real provider-backed auth is required on staging or preview, create that lane intentionally:

- use a stable staging hostname
- provision a separate staging Supabase project or auth environment
- allow-list the staging callback in Supabase Auth
- allow-list the staging origin and redirect URI in Google OAuth
- add a staging auth preflight and smoke target before trusting the lane

Until that exists, production remains the authoritative hosted auth path and staging should be treated as shell/offline/risky smoke only.

Fastest repeatable setup path:

1. Authenticate the Supabase CLI or set `SUPABASE_ACCESS_TOKEN`.
2. Create a second Supabase project for staging.
3. Use the repo helper to inspect or patch auth config:
   - `npm run supabase:auth -- --project-ref <staging-ref> --show`
   - `npm run supabase:auth -- --project-ref <staging-ref> --site-url https://holdfast-staging.pages.dev --redirect-url http://localhost:4173/auth/callback --redirect-url https://holdfast-staging.pages.dev/auth/callback`
4. In Google OAuth, add:
   - JavaScript origin: `https://holdfast-staging.pages.dev`
   - Redirect URI: `https://<staging-ref>.supabase.co/auth/v1/callback`
5. If staging will use Google sign-in immediately, patch the provider too:
   - `npm run supabase:auth -- --project-ref <staging-ref> --enable-google --google-client-id <id> --google-client-secret <secret>`
6. Add staging build-time env locally before running hosted auth smoke:
   - copy `.env.staging.example` to `.env.staging.local`
   - set `VITE_SUPABASE_URL=https://<staging-ref>.supabase.co`
   - set `VITE_SUPABASE_ANON_KEY=<staging-publishable-key>`
7. Deploy or smoke the staging lane against that env file:
   - `npm run cf:pages:staging:deploy -- --env-file .env.staging.local`
   - `npm run cf:pages:staging:auth-preflight -- --env-file .env.staging.local`
   - `npm run cf:pages:staging:auth-smoke -- --env-file .env.staging.local`
   - `npm run cf:pages:staging:sync-smoke -- --env-file .env.staging.local`

What still requires account access:

- creating the second Supabase project
- generating a Supabase personal access token
- adding Google OAuth client origins and redirect URIs
- copying the staging publishable key into local env

Current repo/backend foundation already includes:

- remote Postgres tables for Holdfast user data
- `user_id`-scoped RLS policies
- a private `holdfast-attachments` storage bucket
- attachment storage policies for read, insert, update, and delete

### Google OAuth

- create the Google OAuth client
- add authorized JavaScript origins for localhost, production, and any deliberate staging lane
- add authorized redirect URIs for the callback route
- set app name, support email, and branding basics
- publish a privacy policy URL before public rollout

### Product Gates

- signed-out landing is calm and low-ceremony
- local-to-account attach preserves existing device work
- session recovery preserves local work
- account upgrade preserves data
- cross-device sync works on at least two devices
- offline edits replay cleanly after reconnection

## Release Sequence

1. Keep using the disposable validation project for risky hosted smoke.
2. Use the staging shell project for hosted shell and offline smoke that should not touch production.
3. Keep the production project deployed from the repo helper: `npm run cf:pages:prod:deploy`.
4. Run hosted smoke tests across staging, validation, and production hostnames as appropriate.
5. Treat production as the authoritative provider-backed auth surface until a deliberate staging auth lane exists.
6. Verify service-worker install/update and offline shell behavior on the hosted build.
7. Run broader multi-device sync, offline, and attachment smoke on real accounts.
8. Decide whether to keep or redirect the `*.pages.dev` hostnames.
9. If Git integration becomes necessary later, replace the direct-upload project intentionally instead of assuming an in-place mode switch.

## Current Hosted State

- local Wrangler access is working in the current dev environment
- a disposable validation project exists at `holdfast-validation.pages.dev`
- a dedicated staging shell project exists at `holdfast-staging.pages.dev`
- a production Pages project exists at `holdfast-5oz.pages.dev`
- `holdfast.xylent.studio` is attached and currently serves the app
- hosted shell smoke passes on the production hostname
- hosted shell smoke now passes on the staging shell hostname
- provider-backed production auth smoke passes on `holdfast.xylent.studio`
- same-account hosted sync, attachment download, offline replay, and a common later-offline-edit catch-up path pass on `holdfast.xylent.studio`
- provider-backed staging auth is still blocked because there is no separate staging Supabase auth environment yet
- validation auth preflight and auth smoke still resolve to production because Supabase Auth URL configuration is pinned there
- public launch quality is now blocked by auth/sync trust work, not by Cloudflare project setup

## Useful Checks

- `npm run cf:whoami`
- `npm run cf:pages:list`
- `npm run cf:pages:status`
- `npm run cf:pages:auth-preflight`
- `npm run cf:pages:auth-smoke`
- `npm run cf:pages:validate`
- `npm run cf:pages:staging:status`
- `npm run cf:pages:staging:deploy`
- `npm run cf:pages:staging:smoke`
- `npm run cf:pages:staging:auth-preflight`
- `npm run cf:pages:staging:auth-smoke`
- `npm run cf:pages:staging:sync-smoke`
- `npm run cf:pages:prod:status`
- `npm run cf:pages:prod:deploy`
- `npm run cf:pages:prod:smoke`
- `npm run cf:pages:prod:auth-preflight`
- `npm run cf:pages:prod:auth-smoke`
- `npm run cf:pages:prod:sync-smoke`
- `npm run supabase:auth -- --project-ref <ref> --show`
- `npm run build`
- `npm run test:e2e`
- `npm run test:e2e:hosted -- --base-url https://holdfast-staging.pages.dev`
- `npm run test:e2e:hosted -- --base-url https://holdfast-validation.pages.dev`
- `npm run test:e2e:hosted -- --base-url https://holdfast.xylent.studio`
