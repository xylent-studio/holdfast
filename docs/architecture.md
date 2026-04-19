# Architecture

This file explains how the implementation honors the governing control docs.

## Chosen Direction

Holdfast is built as an installable web app with:

- React + TypeScript + Vite
- IndexedDB via Dexie for the device replica
- a mutation queue for future sync
- a PWA shell for installability and offline resilience
- a sync boundary shaped for Supabase auth, database sync, and file storage
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

- the app opens immediately even before account creation
- if the device is online and the backend is configured, the app should bootstrap an anonymous authenticated session in the background
- if the device is offline, the app should keep a local guest workspace and attach it to the account path once connectivity returns
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

### Mutation queue now, sync worker next

Writes already create mutation-log entries. That shapes the local write model for:

- eventual upload
- retry
- idempotent handling
- conflict inspection

The full sync engine is not wired yet, but the write path is already designed for it.

## Module Boundaries

- `src/domain`
  Product constants, schemas, selectors, and business logic.
- `src/storage/local`
  IndexedDB table definitions, bootstrapping, snapshot assembly, and write commands.
- `src/storage/sync`
  Provider-neutral contracts plus the Supabase config boundary.
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
- public deployment is intentionally gated until the auth flow is at least as trustworthy as the prototype
- the production hostname is planned as `holdfast.xylent.studio`
- GitHub remains the source-control system of record

## Expected Sync Model

1. The app opens into a device-local workspace immediately.
2. If the backend is ready and the device is online, the app creates or resumes an anonymous authenticated session.
3. The device writes to IndexedDB immediately.
4. Mutation records upload in the background.
5. Remote changes are pulled back into the local replica.
6. The user can upgrade the anonymous workspace into a permanent account through linked email or OAuth.
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

- Supabase anonymous auth for low-friction bootstrap
- Supabase manual identity linking for upgrade to email or OAuth
- Cloudflare Turnstile for abuse protection around anonymous sign-in
- RLS policies that distinguish anonymous users from durable member accounts where needed

## Intentionally Not Here Yet

- Supabase auth wiring
- sync worker implementation
- guest-to-member upgrade UI
- attachment preview pipeline
- voice memo recording port
- background retry worker

Those are roadmap items, not hidden assumptions.
