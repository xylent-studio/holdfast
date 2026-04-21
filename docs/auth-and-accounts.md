# Auth And Accounts

## Goal

Auth should make Holdfast feel like a real modern app:

- getting in is easy
- staying signed in is natural
- devices can sync later without weirdness
- offline work remains safe
- account management stays out of the way

## Chosen V1 Direction

Holdfast uses Supabase Auth.

The first public auth path is:

1. `device-guest`
2. `member`

Google OAuth is the primary sign-in path.
Email magic link is the fallback.
Password auth is not the first-path product.

The schema still reserves `anonymous-user`, but that is not the V1 product path and should not be implied in UI or deployment decisions.

## Entry And Session Behavior

### First run

When Supabase auth is configured and the device does not already hold meaningful local work, the user sees a short signed-out landing:

- Holdfast identity
- one-line product promise
- `Continue with Google`
- `Email me a sign-in link`
- one calm trust line

This is the front door.
It is not a feature tour and not an onboarding wizard.

### Existing local workspace

If the device already holds meaningful local work, Holdfast should open that workspace quickly and let the user attach it to an account from inside the app.

User-facing promise:

- keep what is already here
- sync it to the account after sign-in
- do not make sign-in feel like a threat to existing data

### Callback and restore

Auth returns through `/auth/callback`.

The callback surface should:

- restore the session
- return the user to the right app state
- avoid blank or broken-feeling transitions

After that, session restore should be quiet.
If the user is already signed in, the app should reopen local state quickly and let sync catch up in the background.

## Account Surface

The account surface lives inside Settings.

It should stay small:

- signed-in email
- display name if available
- provider
- light sync status
- sign out

Not here yet:

- delete account
- remove local data from this device
- storage or queue mechanics
- provider internals

## Session Recovery

If the device still holds member-owned local data but the session is gone, Holdfast should preserve the local workspace and ask the user to sign in again.

Good recovery language:

- `Sign in again`
- `Local work is still here.`

Bad recovery language:

- session expired
- token invalid
- auth mismatch

## Sign-out Behavior

Sign-out should:

- confirm before proceeding
- stop account access and future sync on this device
- keep local data in place
- avoid implying deletion
- return to a calm signed-out state instead of pretending the device hit an auth failure

Sign-out is not delete.

`Remove data from this device` should be a separate later action.

## Local-To-Account Attachment

When a device-guest workspace signs in:

- keep the local records
- attach the workspace to the signed-in account
- avoid merge/database language in normal UI

Default user-facing line:

- `We'll keep what's already here and sync it to your account.`

## Ownership Direction

The repo and connected Supabase project now include:

- user-scoped Postgres tables for items, lists, list items, day/week records, routines, settings, attachments, and tombstones
- `user_id`-scoped RLS on every user-owned table
- a private attachment bucket with per-user storage policies

Local foundation for that direction remains:

- `authState` tracks whether this device currently has an active backend session
- `identityState` tracks whether the device is still a local guest workspace or a member-owned workspace
- `authPromptState` tracks whether signed-out UI should stay calm, ask for recovery, or block the wrong-account path
- `remoteUserId` keeps the last known signed-in owner on the device

Current safety guard:

- Holdfast does not silently rebind a member-owned local workspace to a different signed-in account on the same device
- if the wrong account signs in, the app signs back out and asks for the original account instead of risking cross-account sync

That local marker is not a full replacement for per-record remote ownership.
Per-record `user_id` scoping now exists remotely, but richer conflict handling and hosted-provider setup still need to be finished before broad public use.

## Redirect And Provider Setup

Required callback route:

- `/auth/callback`

Required allow-list targets:

- `http://localhost:4173/auth/callback`
- `https://holdfast-validation.pages.dev/auth/callback`
- `https://holdfast.xylent.studio/auth/callback`
- preview callback URLs for hosted previews before public testing

Before hosted auth smoke on the validation project, use the repo preflight:

- `npm run cf:pages:auth-preflight`

That checks whether Supabase-generated email-link redirects are still pointing at localhost or another stale origin before a deeper hosted auth pass.

When the preflight passes, run:

- `npm run cf:pages:auth-smoke`
- `npm run cf:pages:prod:auth-smoke`

That hosted auth smoke deploys the current validation build, then uses server-side generated magic links to verify the validation app can sign in, recover a lost local session, and reject the wrong account on a member-owned device workspace.

Current production-domain blocker:

- `holdfast.xylent.studio` is live on Cloudflare Pages
- hosted shell smoke passes on the production hostname
- Supabase is still generating email-link redirects back to the validation origin instead of `https://holdfast.xylent.studio`
- until Supabase Auth URL configuration is updated, provider-backed auth smoke on the production hostname will fail even though the site itself is live

Required Google OAuth basics:

- Google OAuth client
- authorized JavaScript origins
- authorized redirect URIs
- app name and support email
- privacy policy URL before public use

## Current Repo State

The repo now includes:

- a single Supabase browser client boundary
- auth/session state wiring in the app shell
- a signed-out landing
- a callback handoff route
- a small account surface in Settings
- session recovery prompts that preserve local work
- a browser sync engine that pushes/pulls signed-in changes
- a remote Supabase schema with RLS-scoped user tables
- a private attachment bucket and storage policies for synced media

What is still not done:

- cross-device merge logic
- production-domain auth redirect parity
- delete-account and remove-device-data flows
