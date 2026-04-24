# Product

This file translates the governing control docs into an implementation-friendly product summary.

## Product Identity

Holdfast is a calm personal tool for catching, placing, finding, and keeping what matters in real life.

It exists to help the user:

- catch something immediately
- place something directly when the destination is already obvious
- find it again later
- keep things worth preserving even when they are not tasks
- decide what matters now
- park things for later without losing them
- pick back up without a cold start
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

The command view for active work. It should help the user:

- keep a short honest focus list
- see current-day work without backlog fog
- move through what matters without ritual overhead
- use day support only when it actually helps continuity
- own due-today planned work and overdue pressure without previewing future work

### Inbox

The lightest place in the app. It should catch uncertain captures before they disappear without forcing planning at capture time.

### Upcoming

The place for things that are alive but not for now. It must keep three distinct outcomes clear:

- Scheduled
- Undated
- Waiting on

### Review

The retrieval and reflection surface. It should help the user:

- find things again
- see what keeps staying open
- notice pressure building up
- recover context from recent days
- refind saved things, list items, and preserved captures

### Lists

The quiet library for list surfaces. It should help the user:

- get back to the right list quickly
- search lists without turning Review into a second home screen
- create a list when the user wants a real list surface, not just another capture
- bring a whole list into Now or schedule it without turning it into duplicate tasks
- keep repeated list access calm and secondary to command work

## Product Object Direction

The top-level product spine stays:

- Now
- Inbox
- Upcoming
- Review
- Lists

Within that spine, Holdfast should support several real object types:

- captures
- tasks
- notes
- lists
- list items
- attachments and preserved context

Lists are now a first-class top-level destination, but they still should not compete with the rest of the product for meaning. `Lists` is the quiet library home for list surfaces, while contextual list routes remain the place for item-level work.

Whole lists are also first-class day objects:

- they can be scheduled for a future day
- they can be brought into `Now`
- they can be focused for one specific day
- they finish through an explicit decision sheet, not through silent automatic clearing

## Product Boundaries

Holdfast is not:

- a generic task manager
- a team collaboration tool
- a kanban board
- a habit-score game
- a notebook app with task features bolted on
- a settings-heavy system that exposes implementation detail

## What Must Stay True

- the five core areas stay purposeful and distinct
- catch, place, find, and keep stay clearer than productivity-system language
- capture stays faster than organization
- Add stays text-first, with a context-sensitive primary submit and `Save to Inbox` as the fallback
- direct placement works when the destination is already obvious
- routines and day support stay quiet unless the user wants them
- review stays decision-relevant, not analytical theater
- global Add keeps `Save to Inbox` as the default outcome; smarter list routing should show ranked suggestions without quietly hijacking that primary action
- lists stay contextual, searchable, and quick-creatable while also keeping a quiet dedicated library home
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
