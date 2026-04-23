# Holdfast Interaction Model

## Purpose
This file defines how the app should behave at the screen and action level so the product stays consistent even as the implementation changes.

## Global interaction rules
- Fast capture should beat perfect categorization.
- The product should keep coming back to four verbs: catch, place, find, keep.
- The user should spend more time deciding what matters than managing the app.
- The app should reveal complexity only when necessary.
- Every major action should feel calm and obvious.
- The interface should feel more like command and retrieval than planning theater.
- Any flow that makes the user stop and "administer the system" should be treated with suspicion.
- Placement should follow this priority:
  1. current context
  2. explicit user target
  3. Inbox fallback when destination is unclear

## Action hierarchy
### Primary actions
Use for the actions that truly move the product forward:
- Add
- Open
- Done
- Search
- Schedule

### Secondary actions
Use for utility, recovery, or lower-frequency moves:
- Archive
- Retry
- Move to Now
- Plan for later
- Finish day
- Add photo
- Record voice memo

### Quiet actions
Keep visually and verbally light:
- edit small details
- remove attachment
- rename attachment
- change date/time
- switch between views

## Screen rules

## Now
Now is the command view for the day.

It should answer:
- What matters now?
- What is active now?
- What should I act on next?
- What am I carrying into or out of the day?

Now should prioritize:
- current active items
- focused items
- quick movement, completion, and schedule actions
- day context only when it reduces cold start or carry friction

Now should avoid:
- dense historical data
- backlog overload
- too many filters
- settings and explanations
- generic dashboard panels
- a dedicated day-tools panel unless it has clearly proven value

Now should stay protected from list sprawl.

List-related things should only reach Now when:
- the user explicitly promotes them
- the list surface itself is part of current-day command work
- the product has a clear reason to surface them as action now

## Inbox
Inbox is the least demanding place in the app.

It should answer:
- Where can I catch this before I lose it?

Inbox should prioritize:
- low-friction uncertain capture
- quick edits after capture
- moving something to Now, Upcoming, a list surface, or archive
- minimal required decisions

Inbox should avoid:
- forcing metadata
- asking for too much structure too early
- making capture feel like filing

Inbox is the fallback for uncertainty, not the mandatory funnel for every add.

## Upcoming
Upcoming is where things stay alive without crowding now.

It should answer:
- What is scheduled?
- What is kept alive without a date?
- What am I waiting on?

Upcoming should prioritize:
- scheduled items
- undated items
- waiting-on items
- calm scanning

User-facing sections inside Upcoming should be:
- Scheduled
- Undated
- Waiting on

Upcoming should avoid:
- pretending to be a full planner
- showing implementation states
- exposing too much scheduling machinery
- using `queue` as product language
- forcing the user to think in backend terms

Do not add a duplicate fuzzy `Later` state if Upcoming already covers the real need.

## Review
Review is for retrieval and pattern recognition.

It should answer:
- Where did that go?
- What keeps showing up?
- What still matters?
- What patterns are worth noticing?

Review should prioritize:
- search
- retrieval
- list drill-in back into the right list row
- repeated-loop visibility
- recent history and carry-forward honesty
- refinding saved things, list items, and preserved captures
- keeping secondary pattern aids quieter than the main retrieval path

Review should avoid:
- vanity analytics
- cluttered historical dashboards
- information with no decision value

## Lists
Lists is the quiet library home for list surfaces.

It should answer:
- Which list am I trying to get back to?
- What list was active recently?
- Do I need a new list, or just the right existing one?

Lists should prioritize:
- pinned lists
- recent lists
- searchable all-lists access
- fast empty-list creation when the user wants a real list surface

Lists should avoid:
- becoming a second command dashboard
- duplicating Review's search job
- turning list management into admin work

## Capture rules
Capture should be:
- available quickly
- low-friction
- tolerant of incomplete information

Holdfast supports three capture speeds:

### 1. Uncertain capture
- this is the default Add behavior
- it exists to catch the thought before it disappears
- it lands in Inbox
- it should preserve the raw source thought quietly
- it should not require choosing task, note, area, place, or timing first

### 2. Intentional capture in context
- when the user is already inside the destination, Add should still start with text first
- the current destination should be available as a direct action from that calm starting point
- the user should not be bounced back through Inbox when intent is already obvious
- example: inside a grocery list, adding `eggs` should add a list item there immediately

### 3. Directed quick add
- when the user is not in the destination but already knows the target, the flow can ask for that target after the thought is safely caught
- target picking is a secondary step, not the first step
- examples: quick-add to a known grocery list, checklist, note, or pinned collection

Capture should not require:
- lane/category decisions before the user has even caught the thought
- explanatory helper text unless the interaction is genuinely ambiguous
- settings-level thought
- task-versus-note choice as the universal first question

The default Add surface should:
- start with a single calm text entry point
- default its primary submit to the current surface when the destination is already obvious
- keep `Save to Inbox` available as the calm fallback when destination is unclear
- reveal `Choose another place` only after the draft is safely caught
- keep global Add's primary submit as `Save to Inbox`; inferred list suggestions may rank inside target picking, but they should not silently replace the primary global action
- expose `Now`, `Scheduled`, `Undated`, `Waiting on`, the current list when relevant, suggested lists, recent lists, pinned lists, searchable all lists, and `New list...` as alternate destinations
- avoid turning capture into filing

## List and object surface rules
Lists are first-class product objects, and they now have a quiet top-level home.

Lists should be accessed through:
- current context when the user is already inside one
- direct target picking when the user already knows the destination
- pinned surfaces when repeated access is warranted
- `Lists` for library access
- Review and search for retrieval

The `Lists` route should be the lightweight place to start a new empty list surface when the user is intentionally creating one.
Add can quick-create a list only when the user intentionally chooses `New list...` as the destination for the current draft.
Fast Add list creation should ask only for a title and infer the list kind only when the answer is obvious enough to help immediately.

Lists should not:
- compete with Now, Inbox, Upcoming, and Review for top-level meaning
- turn the library home into a second dashboard
- force every list item to behave like a normal task

List item rules:
- list items are children of a list surface
- they should be searchable globally
- they should be visible in Review and retrieval results
- they should only reach Now through an explicit promotion or task-creation action
- sending a list item to `Now` should preserve one identity and mark it with `nowDate`
- they should keep enough identity to support history and refinding without pretending every list item is a top-level task

## Preservation and retrieval rules
Holdfast is not only for action. It is also for keeping things that matter.

The product should support preserved things such as:
- notes worth keeping
- screenshots
- receipts
- photos
- files
- raw captures that have not been fully shaped yet

These preserved things should:
- stay retrievable through Review and search
- keep attachment/context relationships intact
- avoid being forced into fake task semantics
- remain quieter than the underlying storage model

## Schedule rules
Scheduling should feel like deciding an outcome, not filling a form.

Preferred framing:
- Now
- Scheduled
- Undated
- Waiting on
- specific date/time only when useful

Avoid turning scheduling into:
- a heavy modal ceremony
- calendar-management theater
- a field collection exercise

## Closeout rules
Closing the day is a supportive behavior, not a ritual the product should demand.

Closeout should help the user:
- acknowledge what landed
- keep alive what still matters
- avoid reopening the next day cold

Closeout should not:
- lead the main `Now` surface
- feel like journaling homework
- require excessive text
- create duplicated data that confuses later review

The current product should keep closeout available only as quiet supporting behavior. It should not reserve permanent space in the default `Now` layout.

## Settings rules
The correct number of settings is fewer than most implementations want.

Expose a setting only when:
- the user gains meaningful control from it
- the outcome is understandable
- a strong default would not serve most users well

Do not expose settings for:
- backend mechanics
- sync internals
- storage behavior
- architecture details
- features that are not yet proven necessary

## Friction rules
Good friction:
- confirming destructive actions
- asking for clarity when the user truly needs to choose
- surfacing true recovery decisions

Bad friction:
- forcing early categorization
- explaining obvious controls
- making the user choose from too many states
- exposing implementation detail in settings or statuses
