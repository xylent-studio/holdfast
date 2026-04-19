# Holdfast Interaction Model

## Purpose
This file defines how the app should behave at the screen and action level so the product stays consistent even as the implementation changes.

## Global interaction rules
- Fast capture should beat perfect categorization.
- The user should spend more time deciding what matters than managing the app.
- The app should reveal complexity only when necessary.
- Every major action should feel calm and obvious.
- The interface should feel more like command and retrieval than planning theater.
- Any flow that makes the user stop and “administer the system” should be treated with suspicion.

## Action hierarchy
### Primary actions
Use for the actions that truly move the product forward:
- Add
- Save
- Done
- Schedule
- Finish day

### Secondary actions
Use for utility, recovery, or lower-frequency moves:
- Archive
- Retry
- Move to today
- Plan for later
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
- What is active today?
- What should I act on next?
- What am I carrying into or out of the day?

Now should prioritize:
- today’s active items
- focused items
- start/end-of-day context
- quick movement, completion, and schedule actions

Now should avoid:
- dense historical data
- backlog overload
- too many filters
- settings and explanations
- generic dashboard panels

## Inbox
Inbox is the least demanding place in the app.

It should answer:
- Where can I catch this before I lose it?

Inbox should prioritize:
- low-friction capture
- quick edits after capture
- moving something to today, upcoming, or archive
- minimal required decisions

Inbox should avoid:
- forcing metadata
- asking for too much structure too early
- making capture feel like filing

## Upcoming
Upcoming is where things stay alive without crowding now.

It should answer:
- What is not for now, but not lost?
- What is scheduled?
- What am I waiting on?

Upcoming should prioritize:
- planned timing
- later items
- waiting-on items
- calm scanning

Upcoming should avoid:
- pretending to be a full planner
- showing implementation states
- exposing too much scheduling machinery
- forcing the user to think in backend terms

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
- repeated-loop visibility
- recent history and carry-forward honesty

Review should avoid:
- vanity analytics
- cluttered historical dashboards
- information with no decision value

## Capture rules
Capture should be:
- available quickly
- low-friction
- tolerant of incomplete information

Capture should not require:
- lane/category decisions before the user has even caught the thought
- explanatory helper text unless the interaction is genuinely ambiguous
- settings-level thought

## Schedule rules
Scheduling should feel like deciding an outcome, not filling a form.

Preferred framing:
- today
- plan for later
- waiting on
- specific date/time only when useful

Avoid turning scheduling into:
- a heavy modal ceremony
- calendar-management theater
- a field collection exercise

## Closeout rules
Closing the day is a real product behavior, not a decorative feature.

Closeout should help the user:
- acknowledge what landed
- keep alive what still matters
- avoid reopening the next day cold

Closeout should not:
- feel like journaling homework
- require excessive text
- create duplicated data that confuses later review

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
