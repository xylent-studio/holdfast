# Deployment

## Current Release Posture

Holdfast is not ready for public deployment yet.

The repo is prepared for the eventual Cloudflare release, but the public Pages project should not be created until:

- the guest-to-account flow is working
- auth feels at least as trustworthy as the prototype
- sync is safe enough that using the hosted app will not erode trust

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

This does not create a public deployment by itself.

## Required Setup Before Public Launch

### Cloudflare

- authenticate `wrangler`
- restore Cloudflare MCP authentication inside Codex
- confirm the `xylent.studio` zone is accessible in the same Cloudflare account used for Pages

### Supabase

- set `VITE_SUPABASE_URL`
- set `VITE_SUPABASE_ANON_KEY`
- enable anonymous auth
- enable manual identity linking
- configure captcha support for anonymous sign-in
- define RLS and storage policies

### Product Gates

- guest capture works immediately
- anonymous bootstrap is quiet and reliable
- account upgrade preserves data
- cross-device sync works on at least two devices
- offline edits replay cleanly after reconnection

## Release Sequence

1. Finish auth and sync parity.
2. Create the Cloudflare Pages project from the GitHub repository.
3. Set build command `npm run build`.
4. Set build output directory `dist`.
5. Add production environment variables.
6. Attach `holdfast.xylent.studio`.
7. Decide whether to keep or redirect the `*.pages.dev` hostname.
8. Run hosted smoke tests across desktop, mobile, online, and offline states.

## Current Blocker

Cloudflare API access from Codex is currently failing with an authentication error. Repo preparation is complete, but Cloudflare account actions still require you to fix that auth path or provide an equivalent authenticated route.
