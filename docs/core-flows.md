# Core Flows

## 1. Quick Capture

Entry point: `Add`

The user chooses:

- `task` or `note`
- area
- place: `Inbox`, `Now`, or `Upcoming`
- optional timing if it belongs later

Rules:

- capture must not require tags, projects, or attachments up front
- `Inbox` is the default landing place
- `Now` should be intentional, not the default for everything
- `Upcoming` supports both dated and undated items

## 2. Start Day

Entry point: `Now > Start day`

Behavior:

- ensure the current day record exists
- bring in active routines for that weekday
- avoid duplicating already-open routine items for that date
- mark the day as started

## 3. Readiness

`Now` includes a short fixed checklist:

- Water
- Food
- Supplements
- Hygiene
- Movement
- Sleep setup

Rules:

- readiness is binary and intentionally limited
- it is not a health tracker
- once complete, it should stay quiet

## 4. Focus

Focus is the short list inside `Now`.

Rules:

- focus items are still normal items
- focus stays intentionally limited
- adding focus pulls the item into `Now` if needed

## 5. In-Play Work

`Now` combines:

- focused items
- notes in play
- tasks in play
- overdue pressure
- near-term scheduled items

The point is context, not one flat backlog.

## 6. Finish Day

Entry point: `Now > Finish day`

Inputs:

- what landed
- what still matters
- tomorrow seed
- note

Behavior:

- save the closeout on the daily record
- carry unresolved lines into `Upcoming`
- avoid duplicating open items that already exist

## 7. Upcoming

Modes:

- planned
- queue
- waiting on

`Planned` is date-based. `Queue` is undated. `Waiting on` means the user is blocked, not just deferring.

## 8. Review

Review should answer:

- what did I forget?
- what keeps staying open?
- what is building up?
- what happened over the last few days?

It should not become dashboard theater.

## 9. Settings And Routines

Settings should stay minimal and meaningful.

They currently hold:

- direction
- non-negotiables
- why
- weekly focus, protect, and notes
- custom routines

Routines are user-authored recurring structure, not a hidden habit engine.
