# Core Flows

## 1. Capture

Holdfast supports three real capture speeds.

Entry point: `Add`

### 1a. Uncertain capture

Default behavior:

- start with one calm text entry point
- save to Inbox when destination is not yet clear
- preserve the source thought quietly
- do not require task, note, area, place, or timing as the first step

Example:

- `groceries, eggs, coffee, check pantry first`

### 1b. Intentional capture in context

When the user is already inside a destination surface:

- Add should place directly into that surface
- the current context outranks Inbox fallback

Example:

- while inside `Groceries`, adding `eggs` should create a grocery list item there immediately

### 1c. Directed quick add

When the user knows the destination but is not inside it:

- let the user name the thing first
- then allow direct placement into the chosen target
- keep this secondary, not mandatory

Examples:

- quick-add to `Groceries`
- quick-add to a pinned checklist
- quick-add to a known note or collection

Rules:

- capture must not require tags, projects, or attachments up front
- `Inbox` is the fallback for uncertainty, not the mandatory funnel for every add
- direct placement should win when destination is already obvious
- `Now` should be intentional, not the default for everything
- `Upcoming` supports both dated and undated items
- original source context should survive reshaping

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

## 8. Lists and repeated structure

Lists are contextual objects, not a competing top-level navigation model.

Expected list families:

- replenishment lists
- recurring checklists
- one-off project lists
- reference collections

Rules:

- list items stay attached to their list surface by default
- they become top-level tasks only through explicit promotion
- recurring checklists should grow toward template-plus-run behavior
- reference collections should preserve things without pretending everything is actionable

## 9. Review

Review should answer:

- what did I forget?
- what keeps staying open?
- what is building up?
- what happened over the last few days?
- where did I save that?

It should not become dashboard theater.

Review should include retrieval for:

- captures
- tasks
- notes
- lists and list items
- attachments and preserved context

## 10. Settings And Routines

Settings should stay minimal and meaningful.

They currently hold:

- direction
- non-negotiables
- why
- weekly focus, protect, and notes
- custom routines

Routines are user-authored recurring structure, not a hidden habit engine.
