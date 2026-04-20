# Architecture

This file explains how the implementation honors the governing control docs.

## Chosen Direction

Holdfast is built as an installable web app with:

- React + TypeScript + Vite
- IndexedDB via Dexie for the device replica
- a mutation queue and foreground browser sync loop for account-backed sync
- a PWA shell for installability and offline resilience
- a Supabase-backed auth, database, and file-storage boundary
- a Cloudflare Pages deployment target prepared through Wrangler config and repo-local tooling

## Product-Led Architecture Rules

### Sync-first, offline-resilient

The intended user experience is:

- signed in on multiple devices
- automatic sync as the normal path
- seamless offline continuation
- automatic recovery when connectivity returns

That means local persistence is not a side mode. It is the device-level replica behind a synced account-based product.

### Guest start, account continuity

The first session model should match how strong modern apps behave:

- if auth is configured and the device does not already hold meaningful local work, the app should show a minimal sign-in front door
- if the device already holds meaningful local work, the app should open that workspace quickly and let the user attach it to an account from inside the app
- if the device is offline or auth is unavailable, the local workspace should still open safely
- creating an account should upgrade the active workspace instead of asking the user to move data by hand

This is not a separate "local mode". It is the bootstrap path into the same synced product.

### IndexedDB instead of localStorage

The prototype stored the whole app in one `localStorage` blob, including embedded attachments. That is not safe to keep.

Dexie plus IndexedDB gives us:

- structured records
- table-level migrations
- blob storage for attachments
- incremental writes
- cleaner sync boundaries

### Mutation queue and sync loop foundation

Writes already create mutation-log entries. That shapes the local write model for:

- eventual upload
- retry
- idempotent handling
- conflict inspection

The signed-in shell now runs a foreground-tab sync pass that:

- uploads pending local mutations
- pulls remote changes back into IndexedDB
- syncs attachment binaries through Supabase Storage
- records device sync state quietly for the UI

This is not a service-worker or background-worker system yet.
If there is no open signed-in tab, there are no automatic retries.

Conflict handling is intentionally simple for now. Richer merge behavior and broader release hardening still belong on the roadmap.

## Module Boundaries

- `src/domain`
  Product constants, schemas, selectors, and business logic.
- `src/storage/local`
  IndexedDB table definitions, bootstrapping, snapshot assembly, and write commands.
- `src/storage/sync`
  Provider-neutral contracts plus the Supabase config, auth boundary, schema mapping, attachment helpers, and sync engine.
- `src/features`
  Route-level product flows and dialogs.
- `src/app`
  Shell, routing, and top-level state.

## Naming Boundary

The product name for the command view is `Now`.

The current storage alias is still `today` in schemas and selectors. That is an intentional compatibility choice for the current foundation, not the desired long-term product language. When it changes, it should change through an explicit schema migration.

## Local Data Strategy

The local database stores:

- items
- lists
- list items
- daily records
- weekly records
- routines
- settings
- attachment metadata
- attachment blobs
- sync mutation log
- sync state

## Attachment Strategy

Attachments are split into:

- metadata rows
- blob rows

This keeps item records small and makes the remote mapping explicit:

- metadata in database tables
- binary payloads in Supabase Storage
- local blob cache retained for offline access

## PWA And Hosting

The current foundation includes:

- manifest
- installable start URL
- service worker
- runtime shell caching

The frontend output is intentionally compatible with Cloudflare Pages. Supabase is the preferred backend path for auth, database sync, and attachment storage.

Current hosting posture:

- the repo is prepared for Cloudflare Pages through `wrangler.jsonc`
- a disposable validation project can be exercised without creating the production project
- public deployment is intentionally gated until the auth flow is at least as trustworthy as the prototype
- the production hostname is planned as `holdfast.xylent.studio`
- GitHub remains the source-control system of record

## Expected Sync Model

1. The app opens into a device-local workspace immediately.
2. If auth is configured and the device is empty, the app shows the signed-out landing instead of dropping straight into the shell.
3. Google OAuth is the primary sign-in path, with email magic link as fallback.
4. Once signed in, the device writes to IndexedDB immediately and prepares for background sync.
5. Mutation records upload in the background.
6. Remote changes are pulled back into the local replica.
7. Attachments upload separately from metadata.
8. Offline changes remain safe until the network returns.

## Conflict Direction

Holdfast is single-user and multi-device. The conflict posture should be:

- never block local writes on the network
- keep mutation ids and timestamps explicit
- prefer preservation over silent loss
- use field-aware merges where daily records need them
- preserve source context when a capture becomes a task, note, or list item

## Auth And Abuse Controls

The preferred auth path is:

- Supabase Auth as the single provider boundary
- Google OAuth first
- email magic link fallback
- RLS policies scoped by authenticated `user_id`
- explicit redirect allow-lists for localhost, production, and previews

## Intentionally Not Here Yet

- remote merge worker
- remove-device-data and delete-account flows
- attachment preview pipeline
- voice memo recording port
- richer background retry and multi-tab coordination

Those are roadmap items, not hidden assumptions.
