# Auth And Accounts

## Goal

Holdfast should feel like a modern app with automatic continuity across devices, while still letting a new user begin immediately.

That means:

- signed-in sync is the normal long-term experience
- first-run capture should not be blocked behind account creation
- offline behavior should stay natural
- upgrading into a real account should not feel like data migration

## Chosen Account Model

Holdfast uses a three-step account progression:

1. `device-guest`
2. `anonymous-user`
3. `member`

`device-guest` is the local bootstrap state. `anonymous-user` is the first authenticated cloud-backed session. `member` is the durable identity a user can return to across devices.

## Session Direction

The preferred implementation path is:

1. Open the app instantly into the local workspace.
2. If Supabase is configured and the device is online, create or resume an anonymous authenticated session.
3. Start background sync quietly.
4. Let the user upgrade the existing workspace by linking email or OAuth.

If the first launch happens offline, the device should still work. Once connectivity returns, the app should attach that workspace to the anonymous-account path and continue from there.

## Supabase Decisions

Preferred auth behavior:

- Supabase anonymous sign-in enabled
- Supabase manual identity linking enabled
- anonymous guest upgraded into email/password or OAuth instead of creating a second workspace

This keeps the product fast to enter while preserving the signed-in sync-first model the control docs require.

## Security And Abuse Controls

Anonymous auth is useful, but it cannot be left open carelessly.

Required controls:

- Turnstile or equivalent captcha on anonymous sign-in
- row-level security that can distinguish anonymous users from durable members
- cleanup policy for stale anonymous users
- explicit merge policy when an anonymous guest links into an existing member account

## Merge Direction

When a guest upgrades into an existing account, Holdfast should prefer preservation over silent overwrite.

Current direction:

- items merge by id when the same workspace is being upgraded
- attachments stay tied to the upgraded workspace owner
- conflicts should be surfaced only when automatic resolution would risk data loss

## Current Repo State

The repo now reflects this model in the local sync state shape:

- `authState` tracks session presence
- `identityState` tracks `device-guest`, `anonymous-user`, or `member`
- `remoteUserId` is reserved for the authenticated backend owner

The UI flow itself is not wired yet. This file defines the intended path before implementation begins.
