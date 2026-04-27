# Holdfast State and Transition Rules

## Purpose

This file defines the product truth for item states and transitions so implementation details do not distort the model.

User-facing language should say `Now`, not `today`, and should describe `Upcoming` through the sections `Scheduled`, `Undated`, and `Waiting on` rather than leaking queue-style wording.

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
- in UI, this is usually surfaced as `Scheduled` or `Undated`

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
- Do not leak `today` or `queue` wording into the product UI.

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

When a capture becomes a list item:
- the list item should preserve the original capture id as `sourceItemId`
- the original capture should archive out of active circulation instead of lingering as a duplicate open thing

When a top-level task or note moves into a list:
- the resulting list item should preserve the original item id as `sourceItemId`
- the original task or note should archive out of active circulation instead of lingering as a duplicate open thing
- if the top-level item originally came from that same list, the product should prefer restoring the original list item over creating a duplicate
- this should be labeled honestly as conversion into a list item, not a vague move that implies the same object survived unchanged

The product should not require the user to decide task-versus-note before the thought is safely caught.

## Scheduling Relationship

Scheduling is not a separate state by itself. It is additional context that affects placement and visibility.

A scheduled item typically lives in:

- Upcoming before the relevant day
- Now when the scheduled date arrives

Future-scheduled items should not appear in both surfaces at once.

Upcoming should be surfaced as:

- `Scheduled` when the item has a date
- `Undated` when it is alive without a date
- `Waiting on` when the user is blocked

The UI should favor outcome language such as:

- Schedule
- Keep in Upcoming
- Bring to Now
- Save to Inbox

It should avoid exposing raw timing structures as the primary user concept.

Fast-routing schedule actions should require explicit confirmation before changing state.
Using tomorrow as the suggested default is acceptable.
Silently assigning tomorrow is not.

Route-owned movement rules:
- Inbox item cards should show `Place`; the placement sheet should offer `Now`, `Schedule`, `List`, `Keep undated`, `Waiting on`, and `Archive`
- `Now` should reserve strong move language for overdue recovery and keep normal in-play cards focused on command actions such as `Focus now`
- `Upcoming` should use section-specific move verbs instead of one generic `Move to Now` label across every section
- item details should inherit the origin surface so no-op choices read as `Keep in Inbox`, `Keep scheduled`, `Keep undated`, or `Keep waiting`

Overdue should stay explicit without taking over the screen:
- `Now` may collapse overdue behind a summary row such as `Overdue (N)`
- recovery stays available through `Bring to Now`
- do not multiply overdue surfaces elsewhere just because the state exists

The same principle now applies to whole lists:

- a scheduled list lives in `Upcoming` before its day
- a scheduled list belongs in `Now` when that day arrives
- focusing a list is separate from scheduling, even though `Focus now` may perform both outcomes together for convenience

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
- keeps that same identity when promoted into Now
- can become a task when action needs to leave the list surface
- keeps enough identity to support history, refinding, and source preservation

List items should not automatically flood Now just because the parent list is active.

### Whole-list behavior

A whole list:
- can be brought into `Now` as a first-class command object
- can be scheduled for a future day
- can be focused for one specific day
- should stay one list object, not explode into duplicate top-level tasks

Whole-list activation should preserve the distinction between:
- list placement (`Bring to Now`, `Schedule`, `Remove from Now`, `Unschedule`)
- list focus (`Focus now`, `Focus for this day`, `Remove focus`)

### Finish-list outcomes

Finishing a list is never a silent one-tap terminal change.

Allowed finish outcomes:
- `Archive and hide`
- `Clear items for reuse`
- `Reset checkmarks and keep items`
- `Archive run and reset` for replenishment and checklist lists

Rules:
- finishing clears list focus references across days
- reusable outcomes clear active scheduling from the live list that remains
- archived-run snapshots remain searchable in Review and retrieval
- `Archive and hide` preserves the finished list for retrieval instead of hard deleting it

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

Reference-list surface rules:
- reference lists are valid first-class lists
- their default visible surface should emphasize finding and keeping, not finishing
- task-heavy management actions should remain secondary

Replenishment-list surface rules:
- replenishment runs should keep `Add again`
- they should not default to surfacing `Create task` as if every replenishment row were a project task

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

Day context should stay supportive and secondary.

- carry-forward should usually become real `Upcoming` work, not linger as ritual text in `Now`
- closeout should preserve a short seed when useful, not demand end-of-day homework

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
- list navigation starts competing with the rest of the product instead of staying a quiet library home
- state labels expose implementation detail
- scheduling creates duplicate identities or confusing clones
- a reopened item behaves inconsistently across views
- waiting on is just a disguised junk drawer
- archived and done become redundant because the product model is weak
