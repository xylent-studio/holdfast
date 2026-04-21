# Deployment

## Current Release Posture

Holdfast now has a real production Pages project and a live production hostname.

That does not mean launch quality is finished.

As of April 20, 2026:

- local Cloudflare CLI auth is working
- a disposable validation project exists at `https://holdfast-validation.pages.dev`
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
- keep production release gates tied to trust, not to the existence of a hosted URL

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

Current repo/backend foundation already includes:

- remote Postgres tables for Holdfast user data
- `user_id`-scoped RLS policies
- a private `holdfast-attachments` storage bucket
- attachment storage policies for read, insert, update, and delete

### Google OAuth

- create the Google OAuth client
- add authorized JavaScript origins for localhost, validation, and production
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
2. Keep the production project deployed from the repo helper: `npm run cf:pages:prod:deploy`.
3. Run hosted smoke tests across validation and production hostnames.
4. Treat production as the authoritative provider-backed auth surface while Supabase Auth URL configuration stays pinned to production.
5. Verify service-worker install/update and offline shell behavior on the hosted build.
6. Run broader multi-device sync, offline, and attachment smoke on real accounts.
7. Decide whether to keep or redirect the `*.pages.dev` hostname.
8. If Git integration becomes necessary later, replace the direct-upload project intentionally instead of assuming an in-place mode switch.

## Current Hosted State

- local Wrangler access is working in the current dev environment
- a disposable validation project exists at `holdfast-validation.pages.dev`
- a production Pages project exists at `holdfast-5oz.pages.dev`
- `holdfast.xylent.studio` is attached and currently serves the app
- hosted shell smoke passes on the production hostname
- provider-backed production auth smoke passes on `holdfast.xylent.studio`
- same-account hosted sync, attachment download, offline replay, and a common later-offline-edit catch-up path pass on `holdfast.xylent.studio`
- validation auth preflight and auth smoke now fail because Supabase generates magic-link redirects to the production origin while the Auth URL configuration is pinned there
- public launch quality is now blocked by auth/sync trust work, not by Cloudflare project setup

## Useful Checks

- `npm run cf:whoami`
- `npm run cf:pages:list`
- `npm run cf:pages:status`
- `npm run cf:pages:auth-preflight`
- `npm run cf:pages:auth-smoke`
- `npm run cf:pages:validate`
- `npm run cf:pages:prod:status`
- `npm run cf:pages:prod:deploy`
- `npm run cf:pages:prod:smoke`
- `npm run cf:pages:prod:auth-preflight`
- `npm run cf:pages:prod:auth-smoke`
- `npm run cf:pages:prod:sync-smoke`
- `npm run build`
- `npm run test:e2e`
- `npm run test:e2e:hosted -- --base-url https://holdfast-validation.pages.dev`
- `npm run test:e2e:hosted -- --base-url https://holdfast.xylent.studio`
