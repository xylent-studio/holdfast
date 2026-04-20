# Deployment

## Current Release Posture

Holdfast is not ready for public deployment yet.

The repo is prepared for the eventual Cloudflare release, but the public production Pages project should not be created until:

- the signed-out landing and account-attach flow are working
- auth feels at least as trustworthy as the prototype
- sync is safe enough that using the hosted app will not erode trust

As of April 20, 2026:

- local Cloudflare CLI auth is working
- a disposable validation project exists at `https://holdfast-validation.pages.dev`
- the production project does not exist yet
- no production hostname is attached yet

## Chosen Hosting Direction

- frontend hosting: Cloudflare Pages
- source control: GitHub repo `xylent-studio/holdfast`
- production hostname: `holdfast.xylent.studio`
- backend/auth/sync: Supabase

## Deployment Mode Choice

When Holdfast is ready to go public, use Cloudflare Pages with Git integration.

Reasons:

- it matches the GitHub-first workflow
- it gives preview deployments for pull requests
- it is the cleanest default for a frontend-heavy React app

Important constraint:

- Cloudflare documents that Pages projects created with Git integration cannot later switch to Direct Upload

That is acceptable here because GitHub is already the source of truth.

## Hosted Validation Track

Before public launch, Holdfast now uses a separate disposable Pages project for hosted smoke:

- validation project: `holdfast-validation`
- validation origin: `https://holdfast-validation.pages.dev`
- current repo command: `npm run cf:pages:validate`

This is intentionally separate from the eventual production project.

Why:

- it lets the repo exercise real hosted auth/callback/offline behavior now
- it keeps the eventual production `holdfast` project clean for Git integration
- it avoids locking the production project into Direct Upload just to get early hosted smoke

Before provider-backed hosted auth smoke, run:

- `npm run cf:pages:auth-preflight`

That preflight uses a server-only Supabase key from the shell to verify that generated email-link redirects stay on the hosted validation origin instead of falling back to localhost or another stale Site URL.

Once that passes, run:

- `npm run cf:pages:auth-smoke`

That deploys the current build to the validation project, then uses server-side generated magic links to exercise hosted sign-in, recovery, and wrong-account protection against that live deployment.

Rules:

- do not attach `holdfast.xylent.studio` to the validation project
- do not treat the validation project as public launch
- keep production release gates tied to trust, not to the existence of a disposable hosted URL

## Repo Baseline

The repo now includes:

- project-local `wrangler`
- `wrangler.jsonc` for source-controlled Pages configuration
- a repo-local Pages validation script at `scripts/pages-validation.mjs`
- npm scripts for Cloudflare auth, Pages status, and hosted validation
- Playwright smoke that can run locally or against a hosted URL
- pinned local Node version files for reproducible builds

This does not create a public deployment by itself.

## Required Setup Before Public Launch

### Cloudflare

- authenticate `wrangler`
- confirm the `xylent.studio` zone is accessible in the same Cloudflare account used for Pages
- create the Pages project only after the product gates below are met

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
- add authorized JavaScript origins for localhost, preview, and production
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

1. Keep using the disposable validation project for hosted smoke.
2. Add the validation `pages.dev` callback/origin to Supabase and Google before provider-backed hosted auth smoke.
3. Finish auth and sync parity.
4. Create the production Cloudflare Pages project from the GitHub repository.
5. Set build command `npm run build`.
6. Set build output directory `dist`.
7. Pin the Pages Node version to `24.14.0`.
8. Add production environment variables.
9. Configure Supabase Site URL and redirect allow-list entries for dev, validation, preview, and production.
10. Attach `holdfast.xylent.studio`.
11. Decide whether to keep or redirect the `*.pages.dev` hostname.
12. Run hosted smoke tests across desktop, mobile, online, and offline states.
13. Verify service-worker install/update and offline shell behavior on the hosted build.

## Current Hosted State

- local Wrangler access is working in the current dev environment
- a disposable validation project exists at `holdfast-validation.pages.dev`
- the production Pages project does not exist yet
- no production hostname is attached yet
- hosted smoke is now possible without creating the production project
- public release remains blocked by product readiness, not CLI authentication

## Useful Checks

- `npm run cf:whoami`
- `npm run cf:pages:list`
- `npm run cf:pages:status`
- `npm run cf:pages:auth-preflight`
- `npm run cf:pages:auth-smoke`
- `npm run cf:pages:validate`
- `npm run build`
- `npm run test:e2e`
- `npm run test:e2e:hosted -- --base-url https://holdfast-validation.pages.dev`
