# Core Flows

Holdfast should keep coming back to four user outcomes:

- catch it
- place it
- find it
- keep it

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

- Add should still open as one calm text entry point first
- the current context should be available as a direct action, not a filing form
- the user should be able to save to Inbox instead when the destination is suddenly less clear

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
- `Upcoming` should surface dated items as `Scheduled` and undated items as `Undated`
- original source context should survive reshaping

## 2. Now command work

Focus is the short list inside `Now`.

Rules:

- focus items are still normal items
- focus stays intentionally limited
- adding focus pulls the item into `Now` if needed

## 3. In-Play Work

`Now` combines:

- focused items
- notes in play
- tasks in play
- overdue pressure
- near-term scheduled items

The point is context, not one flat backlog.

## 4. Upcoming

Modes:

- Scheduled
- Undated
- Waiting on

`Scheduled` is date-based. `Undated` is alive without a date. `Waiting on` means the user is blocked, not just deferring.

## 5. Lists and repeated structure

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
- Review can create a new list surface without adding a new top-level navigation model

## 6. Review and retrieval

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

Review should also be the first honest place to revisit list surfaces before Holdfast ever grows a separate list home.

Secondary pattern aids such as recent days, repeating loops, and overdue pressure should stay available, but they should not crowd the default retrieval surface.

## 7. Optional day support

Day support exists to reduce cold starts and keep continuity, not to make the user maintain a ritual.

Entry points:

- `Now > Open day tools`
- `Now > Finish day`

Behavior:

- ensure the current day record exists when the user explicitly starts the day
- bring in active routines for that weekday without duplicating already-open routine items
- keep readiness as a short fixed checklist:
  - Water
  - Food
  - Supplements
  - Hygiene
  - Movement
  - Sleep setup
- save closeout only when the user wants the extra continuity
- carry unresolved lines into `Upcoming`
- preserve a short tomorrow seed without turning closeout into homework

Rules:

- readiness is binary and intentionally limited
- it is not a health tracker
- once complete, it should stay quiet
- start day and finish day are supportive tools, not the main job of `Now`

## 8. Settings And Routines

Settings should stay minimal and meaningful.

They currently hold:

- direction
- non-negotiables
- why
- weekly focus, protect, and notes
- custom routines

Routines are user-authored recurring structure, not a hidden habit engine.
