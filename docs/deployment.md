# Deployment

## Current Release Posture

Holdfast now has a real production Pages project and a live production hostname.

That does not mean launch quality is finished.

As of April 23, 2026, after a fresh manual hosted validation pass:

- local Cloudflare CLI auth is working
- a disposable validation project exists at `https://holdfast-validation.pages.dev`
- a dedicated staging project exists at `https://holdfast-staging.pages.dev`
- a production direct-upload Pages project exists at `https://holdfast-5oz.pages.dev`
- the custom hostname `https://holdfast.xylent.studio` is attached and serving
- hosted shell smoke passes on the production hostname
- hosted shell smoke passes on the staging hostname
- provider-backed production auth smoke passes on the production hostname
- provider-backed staging auth smoke passes on the staging hostname
- same-account hosted sync, attachment download, offline replay, and a common later-offline-edit catch-up path pass on the production hostname
- same-account staged sync, attachment download, offline replay, and a common later-offline-edit catch-up path pass on the staging hostname

These hosted claims are not continuously proven by the default GitHub Actions CI job. The repo has hosted auth/sync smoke coverage, but those suites are env-gated because they need real hosted URLs and secrets. Re-run the hosted smoke commands before relying on the hosted state after unrelated changes.

The repo now also includes `.github/workflows/hosted-validation.yml` for manual hosted verification when the required GitHub secrets are configured.

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

## Hosted Validation Fallback

Holdfast still keeps a separate disposable Pages project for hosted smoke:

- validation project: `holdfast-validation`
- validation origin: `https://holdfast-validation.pages.dev`
- current repo command: `npm run cf:pages:validate`

This stays separate from production, and it is not part of the normal release path.

Why:

- it lets the repo exercise risky hosted callback/offline behavior without touching the public hostname
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
- do not treat staging auth as available until the staging Supabase project, auth config, and hosted smoke checks are all in place
- keep production release gates tied to trust, not to the existence of a hosted URL
- prefer staging for any release candidate that might reasonably ship

## Staging Track

Holdfast now also has a dedicated Cloudflare staging surface:

- staging project: `holdfast-staging`
- staging origin: `https://holdfast-staging.pages.dev`

Current use:

- hosted auth smoke
- hosted sync smoke
- hosted shell smoke
- service-worker and offline shell checks
- risky UI and release checks that should not touch production
- direct-upload release candidates deploy to the `main` branch label inside the staging project so `https://holdfast-staging.pages.dev` serves the exact staged build under test

Current posture:

- staging now has its own Supabase project and auth configuration
- staging deploys can target that project with `.env.staging.local`
- staging should be the first provider-backed lane for risky auth and sync validation before promoting the same changes to production

## Repo Baseline

The repo now includes:

- project-local `wrangler`
- `wrangler.jsonc` for source-controlled Pages configuration
- a repo-local Pages deployment helper at `scripts/pages-validation.mjs`
- a repo-local release helper at `scripts/release-flow.mjs`
- npm scripts for validation, staging, and production Pages status, deploy, and smoke
- npm scripts for intentional `release:staging` and `release:prod` passes
- Playwright smoke that can run locally or against a hosted URL
- pinned local Node version files for reproducible builds
- build metadata stamped from the current commit for runtime diagnostics and service-worker versioning

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
- staging and production Pages deploys now verify that the target Supabase project exposes every checked-in repo migration by name before upload starts
- production Supabase project ref: `acpaqcdttgdofwcsnhxf`
- staging Supabase project ref: `tgldornordukkssrbjlc`
- add redirect allow-list entries for:
  - `http://localhost:4173/auth/callback`
  - `https://holdfast-validation.pages.dev/auth/callback`
  - `https://holdfast.xylent.studio/auth/callback`
  - preview callback URLs before public preview testing

### Staging auth lane

Holdfast now has a real provider-backed staging auth lane:

- staging hostname: `https://holdfast-staging.pages.dev`
- staging Supabase project: `tgldornordukkssrbjlc`
- staging callback: `https://holdfast-staging.pages.dev/auth/callback`
- staging Google callback: `https://tgldornordukkssrbjlc.supabase.co/auth/v1/callback`

Expected use:

- validate risky auth and sync changes on staging first
- keep production as the public trusted lane
- use validation only for disposable shell/offline checks when production or staging should stay untouched

Fastest repeatable setup path:

1. Authenticate the Supabase CLI or set `SUPABASE_ACCESS_TOKEN`.
   - local-only convenience: `.env.local` and `.env.secrets.local` are also read by the Supabase auth helper and hosted Pages validation helper
2. Use the repo helper to inspect or patch auth config:
   - `npm run supabase:auth -- --project-ref <staging-ref> --show`
   - `npm run supabase:auth -- --project-ref <staging-ref> --site-url https://holdfast-staging.pages.dev --redirect-url http://localhost:4173/auth/callback --redirect-url https://holdfast-staging.pages.dev/auth/callback`
3. In Google OAuth, add:
   - JavaScript origin: `https://holdfast-staging.pages.dev`
   - Redirect URI: `https://<staging-ref>.supabase.co/auth/v1/callback`
4. If staging will use Google sign-in immediately, patch the provider too:
   - `npm run supabase:auth -- --project-ref <staging-ref> --enable-google --google-client-id <id> --google-client-secret <secret>`
5. Add staging build-time env locally before running hosted auth smoke:
   - copy `.env.staging.example` to `.env.staging.local`
   - set `VITE_SUPABASE_URL=https://<staging-ref>.supabase.co`
   - set `VITE_SUPABASE_ANON_KEY=<staging-publishable-key>`
6. Deploy or smoke the staging lane against that env file:
   - `npm run cf:pages:staging:deploy -- --env-file .env.staging.local`
   - `npm run cf:pages:staging:auth-preflight -- --env-file .env.staging.local`
   - `npm run cf:pages:staging:auth-smoke -- --env-file .env.staging.local`
   - `npm run cf:pages:staging:sync-smoke -- --env-file .env.staging.local`

What still requires account access:

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

1. Run `npm run release:staging` for a release candidate pass.
2. That staging pass should cover local lint, typecheck, unit tests, local Playwright, staging deploy, staging auth smoke, and staging sync smoke.
3. Review the staged build on `https://holdfast-staging.pages.dev`; branch alias URLs are not the release gate because the public staging root is the surface that must be proven.
4. Use `npm run release:prod` for the locked production repair or promotion path.
5. `release:prod` now runs local validation again, deploys and validates staging for the current committed `main` SHA, then deploys production and runs hosted production shell/auth/sync smoke only after staging passes.
6. Production deploys now refuse release-affecting dirty files by default. The helper ignores the unrelated local-only `scripts/rehydrate-agent.ps1` dirtiness, but everything else should be committed or stashed first.
7. Production deploys must target the existing `holdfast` Pages project on `main`; the release helper no longer treats production project creation as part of the normal path.
8. Production deploys refuse to run unless local `HEAD` matches `origin/main`, unless an explicit emergency override is passed for a documented repair.
9. Staging and production deploys fail early when the target Supabase migration history is missing checked-in repo migrations by name. Keep `SUPABASE_ACCESS_TOKEN` available in the shell or local env so that guard can run.
10. Keep the validation project out of the normal release path. Use it only when staging or production should remain untouched.
11. Verify service-worker install/update and offline shell behavior on the hosted build when the release changes those surfaces.
12. Run broader multi-device sync, offline, attachment, and list-surface smoke on real accounts when auth, sync, or attachment behavior changes materially.
13. Decide later whether to keep or redirect the `*.pages.dev` hostnames.
14. If Git integration becomes necessary later, replace the direct-upload project intentionally instead of assuming an in-place mode switch.

## GitHub Hosted Smoke Secrets

To let GitHub Actions run the hosted staging and production smoke lane on demand, configure:

- `CLOUDFLARE_API_TOKEN`
- `SUPABASE_ACCESS_TOKEN`
- `PLAYWRIGHT_STAGING_SUPABASE_URL`
- `PLAYWRIGHT_STAGING_SUPABASE_ANON_KEY`
- `PLAYWRIGHT_PROD_SUPABASE_URL`
- `PLAYWRIGHT_PROD_SUPABASE_ANON_KEY`

That secret-backed workflow is separate from the default CI job on purpose. Default CI stays secretless and fast; the manual hosted smoke workflow gives you a repo-native way to re-check the real staged and production lanes without spending those minutes on every push.

## Current Hosted State

- local Wrangler access is working in the current dev environment
- a disposable validation project exists at `holdfast-validation.pages.dev`
- a dedicated staging project exists at `holdfast-staging.pages.dev`
- a production Pages project exists at `holdfast-5oz.pages.dev`
- `holdfast.xylent.studio` is attached and currently serves the app
- hosted shell smoke passes on the production hostname
- hosted shell smoke now passes on the staging hostname
- provider-backed staging auth smoke now passes on `holdfast-staging.pages.dev`
- same-account staged sync, attachment download, offline replay, and a common later-offline-edit catch-up path now pass on `holdfast-staging.pages.dev`
- provider-backed production auth smoke passes on `holdfast.xylent.studio`
- same-account hosted sync, attachment download, offline replay, and a common later-offline-edit catch-up path pass on `holdfast.xylent.studio`
- validation auth preflight and auth smoke still resolve to production because Supabase Auth URL configuration is pinned there
- public launch quality is now blocked by auth/sync trust work, not by Cloudflare project setup

## Useful Checks

- `npm run cf:whoami`
- `npm run cf:pages:list`
- `npm run cf:pages:status`
- `npm run cf:pages:auth-preflight`
- `npm run cf:pages:auth-smoke`
- `npm run cf:pages:validate`
- `npm run release:staging`
- `npm run release:prod`
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
