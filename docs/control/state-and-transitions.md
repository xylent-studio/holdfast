# Holdfast State and Transition Rules

## Purpose

This file defines the product truth for item states and transitions so implementation details do not distort the model.

## Core Objects

- Capture
- Task
- Note
- List
- List item
- Routine
- Day context
- Attachments, photos, and voice memos

## Capture vs Task vs Note

### Capture

A capture is the raw source thought caught before the user has fully shaped it.

A capture may later become:
- a task
- a note
- a list item
- a preserved saved thing

The original source context should be preserved quietly even when the user reshapes it later.

### Task

A task implies action.

### Note

A note is worth keeping, not necessarily doing.

A note can become a task.
A task can become a note if action is no longer the right frame.

This conversion should feel natural and preserve context.

Capture is not the same thing as note.

Notes are already-shaped kept information.
Captures are intentionally earlier and less committed than that.

## Core Item States

These are user-facing product states, not necessarily one-to-one database fields.

### Inbox

Caught, but not yet actively placed.

### Now

Relevant to the current day's command view.

### Upcoming

Not for now, but still alive.

### Waiting on

Blocked by another person, system, or event.

### Done

Completed action.

### Archived

Removed from active circulation without deleting.

## State Meanings

### Inbox

Meaning:

- I need this kept, but I have not fully placed it yet.

### Now

Meaning:

- this belongs in the current day's command view

### Upcoming

Meaning:

- not now, but intentionally not lost

### Waiting on

Meaning:

- I cannot move this myself right now, but it still matters

### Done

Meaning:

- the action is complete

### Archived

Meaning:

- keep it, but do not keep it active

## Transition Principles

- Moving between states should preserve context.
- State changes should feel outcome-based, not system-based.
- Avoid state explosion.
- Do not create near-duplicate states just because the implementation can.
- Never use status naming that feels like internal workflow plumbing.

## Allowed Transitions

### Common Task Transitions

- Inbox -> Now
- Inbox -> Upcoming
- Inbox -> Waiting on
- Inbox -> Archived

- Now -> Done
- Now -> Upcoming
- Now -> Waiting on
- Now -> Archived
- Now -> Inbox only if there is a good product reason, not because the state model is weak

- Upcoming -> Now
- Upcoming -> Waiting on
- Upcoming -> Archived
- Upcoming -> Done if the completion makes sense without first surfacing in Now

- Waiting on -> Now
- Waiting on -> Upcoming
- Waiting on -> Archived
- Waiting on -> Done when appropriate

- Done -> Now only as an intentional reopen action
- Done -> Archived if needed

### Note Transitions

- Inbox -> Now
- Inbox -> Upcoming
- Inbox -> Archived

- Now -> Inbox or Upcoming if it should remain visible elsewhere
- Now -> Archived

- Upcoming -> Now
- Upcoming -> Archived

Notes do not use Done as their normal terminal state unless the product explicitly chooses to support note completion semantics. Default assumption: notes are kept or archived, not completed.

### Capture Transitions

- Capture -> Task
- Capture -> Note
- Capture -> List item
- Capture -> Archived

Capture is not a mandatory permanent state. It is a preservation-first entry state.

The product should not require the user to decide task-versus-note before the thought is safely caught.

## Scheduling Relationship

Scheduling is not a separate state by itself. It is additional context that affects placement and visibility.

A scheduled item typically lives in:

- Upcoming before the relevant day
- Now when it becomes current

The UI should favor outcome language such as:

- Schedule
- Plan for later
- Move to today

It should avoid exposing raw timing structures as the primary user concept.

## Waiting On Relationship

Waiting on is a meaningful product state because it changes what action is possible.

Use it when:

- the user is blocked
- the item still matters
- surfacing the blocked nature is useful

Do not use it for:

- vague procrastination
- weak categorization
- "not now" when Upcoming already covers that need

## List Rules

Holdfast supports multiple list behaviors because real life uses multiple list behaviors.

At minimum, the model should support:
- replenishment lists
- recurring checklists
- one-off project lists
- reference or parking collections

These are not all the same product object in practice, even if they may share storage primitives.

### List item behavior

A list item:
- belongs to a list surface
- is searchable globally
- can appear in Review
- can be promoted into Now through an explicit action
- can become a task when action needs to leave the list surface
- keeps enough identity to support history, refinding, and source preservation

List items should not automatically flood Now just because the parent list is active.

### Checklist and run direction

Recurring checklists should support:
- reusable structure
- fresh runs
- history
- optional carry-forward when that behavior is truly helpful

This is distinct from one-off project lists and from replenishment lists.

### Replenishment direction

Replenishment lists should support:
- a persistent named container
- an active current run
- remembered past completion without turning the product into a shopping-history dashboard

## No Duplicate Later State

`Later` should not be added as a fuzzy new top-level holding state unless a clear product gap appears.

Use:
- `Upcoming` for time-based or intentionally deferred active things
- list collections for grouped kept things
- Review and search for retrieval

Do not create a second vague holding pen when the real need is clearer list behavior or stronger retrieval.

## Preservation Rules

Some things should remain preserved without becoming action.

Examples:
- saved notes
- receipts
- screenshots
- photos
- files
- raw captures

These should live in the retrieval model of the product, not be forced into fake completion states.

## Day Context Rules

Day context is not just a collection of loose notes. It should support command and continuity.

Important day-level concepts:

- focus
- closeout
- carry-forward
- seed into next day

These should help the user:

- know what mattered
- know what remains alive
- avoid a cold start the next day

## Routine Rules

Routines should be supportive, not oppressive.

A routine is:

- recurring structure the app can surface or seed

A routine is not:

- a full habit engine
- a scorekeeping mechanic
- a reason to flood the day with obligations

## Attachment And Media Rules

Attachments, photos, and voice memos attach to items as durable context.

Rules:

- they should survive state transitions
- they should survive device changes
- pending uploads should not destroy item usability
- media should not feel like separate orphan data

## Stop-Ship State Failures

Do not ship behavior where:
- every add is forced through task, note, area, place, and timing before the thought is safe
- notes and tasks drift semantically until the difference is meaningless
- captures are overwritten in a way that destroys original source context
- list items are flattened into generic tasks because the model is too weak
- a list surface quietly becomes a second navigation app inside Holdfast
- state labels expose implementation detail
- scheduling creates duplicate identities or confusing clones
- a reopened item behaves inconsistently across views
- waiting on is just a disguised junk drawer
- archived and done become redundant because the product model is weak
