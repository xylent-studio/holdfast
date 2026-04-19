# Product

This file translates the governing control docs into an implementation-friendly product summary.

## Product Identity

Holdfast is a personal operating system for staying in command of real life day by day.

It exists to help the user:

- catch something immediately
- place something directly when the destination is already obvious
- decide what matters now
- park things for later without losing them
- keep things worth preserving even when they are not tasks
- finish the day cleanly
- pick back up on any device without friction
- trust that nothing important quietly vanished

## Product Qualities

Holdfast should feel:

- calm
- direct
- modern
- trustworthy
- private
- low-friction
- serious without being heavy

## Core Spine

### Now

The command view for the day. It should help the user:

- start the day
- handle readiness basics quickly
- keep a short honest focus list
- see what is active without backlog fog
- finish the day cleanly

### Inbox

The lightest place in the app. It should catch uncertain captures before they disappear without forcing planning at capture time.

### Upcoming

The place for things that are alive but not for now. It must keep three distinct outcomes clear:

- planned
- queue
- waiting on

### Review

The retrieval and reflection surface. It should help the user:

- find things again
- see what keeps staying open
- notice pressure building up
- recover context from recent days
- refind saved things, list items, and preserved captures

## Product Object Direction

The top-level product spine stays:

- Now
- Inbox
- Upcoming
- Review

Within that spine, Holdfast should support several real object types:

- captures
- tasks
- notes
- lists
- list items
- attachments and preserved context

This does not justify a second competing nav model.

Lists should live as contextual surfaces, pinned objects, and retrieval targets rather than automatically becoming a new top-level tab.

## Product Boundaries

Holdfast is not:

- a generic task manager
- a team collaboration tool
- a kanban board
- a habit-score game
- a notebook app with task features bolted on
- a settings-heavy system that exposes implementation detail

## What Must Stay True

- the four core areas stay purposeful and distinct
- capture stays faster than organization
- direct placement works when the destination is already obvious
- routines support the day without becoming a habit engine
- review stays decision-relevant, not analytical theater
- the normal long-term experience is signed-in and synced
- first-time sign-in should be one tap or a magic link, not a form wall
- if local work already exists, the app should open it quickly and let that workspace attach to an account without loss
- signing out should stop account access without deleting local work
- offline behavior is resilient and quiet
- attachments and voice memos are real product data, not extras
- preserved saved things remain retrievable without being forced into fake task semantics

## Account Shape

Holdfast should behave like a modern app that just works:

- the normal expectation is cross-device continuity through an account-backed session
- the signed-out front door should stay short, calm, and low-ceremony
- local guest use should attach cleanly into an account-backed workspace
- the user should not feel forced into manual export, import, or mode switching
