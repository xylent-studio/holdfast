# Deployment

## Current Release Posture

Holdfast is not ready for public deployment yet.

The repo is prepared for the eventual Cloudflare release, but the public Pages project should not be created until:

- the signed-out landing and account-attach flow are working
- auth feels at least as trustworthy as the prototype
- sync is safe enough that using the hosted app will not erode trust

As of April 20, 2026:

- local Cloudflare CLI auth is working
- `wrangler pages project list --json` returns `[]`
- no Pages project exists yet for Holdfast

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

## Repo Baseline

The repo now includes:

- project-local `wrangler`
- `wrangler.jsonc` for source-controlled Pages configuration
- npm scripts for basic Cloudflare auth checks
- Playwright-based auth-landing smoke coverage in CI
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

1. Finish auth and sync parity.
2. Create the Cloudflare Pages project from the GitHub repository.
3. Set build command `npm run build`.
4. Set build output directory `dist`.
5. Pin the Pages Node version to `24.14.0`.
6. Add production environment variables.
7. Configure Supabase Site URL and redirect allow-list entries for dev, preview, and production.
8. Attach `holdfast.xylent.studio`.
9. Decide whether to keep or redirect the `*.pages.dev` hostname.
10. Run hosted smoke tests across desktop, mobile, online, and offline states.
11. Verify service-worker install/update and offline shell behavior on the hosted build.

## Current Hosted State

- local Wrangler access is working in the current dev environment
- no Cloudflare Pages project exists yet
- no production hostname is attached yet
- hosted release remains blocked by product readiness, not CLI authentication

## Useful Checks

- `npm run cf:whoami`
- `npx wrangler pages project list --json`
- `npm run build`
- `npm run test:e2e`
