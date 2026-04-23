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
- the primary Add submit should follow the current surface:
  - `Now` -> `Add to Now`
  - `Upcoming > Scheduled` -> `Schedule`
  - `Upcoming > Undated` -> `Keep in Upcoming`
  - `Upcoming > Waiting on` -> `Add to Waiting on`
  - `List` -> `Add to <list>`
  - global surfaces -> `Save to Inbox`
- `Choose another place` should expose `Now`, `Scheduled`, `Undated`, `Waiting on`, the current list when relevant, suggested lists, recent lists, pinned lists, searchable all lists, and `New list...`
- Add can quick-create a new list and use the captured draft as the first list item
- fast Add list creation should ask only for the list title, infer the kind when it is obvious, and otherwise fall back to `project`
- `Upcoming` should surface dated items as `Scheduled` and undated items as `Undated`
- original source context should survive reshaping

## 2. Now command work

Focus is the short list inside `Now`.

Rules:

- focus items are still normal items
- focus stays intentionally limited
- adding focus pulls a top-level item into `Now` if needed
- moving something to `Now` does not silently focus it

## 3. In-Play Work

`Now` combines:

- focused items
- top-level notes and tasks in play
- list items explicitly promoted into `Now`
- overdue pressure
- due-today planned work whose scheduled date has arrived

The point is context, not one flat backlog.

## 4. Upcoming

Modes:

- Scheduled
- Undated
- Waiting on

`Scheduled` is date-based and should show all scheduled work from the selected date forward, grouped by date. `Undated` is alive without a date. `Waiting on` means the user is blocked by a person, system, or event, not just deferring.

## 5. Lists and repeated structure

Lists are first-class product objects with a quiet top-level library home.

Expected list families:

- replenishment lists
- recurring checklists
- one-off project lists
- reference collections

Rules:

- list items stay attached to their list surface by default
- list surfaces should lead with what is current in that list right now
- done items should stay secondary and can remain hidden until the user asks for them
- sending a list item to `Now` should keep it as a list item through `nowDate`, not clone it into a separate task
- they become top-level tasks only through an explicit `Create task` action
- a capture can be sent to a list, preserving `sourceItemId`, while the original capture archives out of active circulation
- a top-level task or note can also move into a list, preserving `sourceItemId` and archiving the original out of active circulation
- recurring checklists should grow toward template-plus-run behavior
- reference collections should preserve things without pretending everything is actionable
- `Lists` owns pinned, recent, and searchable list-library access
- Add can also quick-create a new list when the captured draft clearly belongs there

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

Inside Review, retrieval should stay primary:

- search remains the first move
- match reasons should be visible, not inferred from hidden fields
- list-item results should return the user to the correct list row
- the list library itself should live in `Lists`, not inside Review

Secondary pattern aids such as recent days, repeating loops, and overdue pressure should stay available, but they should not crowd the default retrieval surface.

## 7. Optional day support

Day support exists to reduce cold starts and keep continuity, not to make the user maintain a ritual.

Current posture:

- `Now` should not dedicate a default panel to day mechanics
- carry-forward context can surface quietly when it helps the user restart
- closeout can remain in the foundation without leading the command surface until it proves that it reduces real friction

Behavior:

- ensure the current day record exists when the product needs it
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
- start day and finish day are supportive behaviors, not the main job of `Now`

## 8. Settings And Routines

Settings should stay minimal and meaningful.

They currently hold:

- direction
- non-negotiables
- why
- weekly focus, protect, and notes
- custom routines

Routines are user-authored recurring structure, not a hidden habit engine.
