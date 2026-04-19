# Holdfast V1 Scope

## Purpose of V1

V1 is not the smallest technical build. It is the first version that feels like the real product.

It must prove that Holdfast can be:

- trusted
- used across devices
- used offline without drama
- fast enough for real life
- distinct from generic productivity apps
- able to catch, place, and refind real-life things without turning capture into administration

## Must-ship outcomes

By the time V1 is done, a user should be able to:

- sign in and stay signed in across devices
- capture something quickly from any device
- see the same state across devices with automatic sync
- keep using the app while offline
- return online and have changes reconcile automatically
- manage today without drowning in backlog
- park things for later without losing them
- retrieve context and see patterns in review
- place something directly when the destination is already obvious
- keep preserved things without pretending everything is a task
- attach files, photos, and voice memos without the feature feeling bolted on

## Must-ship capabilities

### Account and continuity

- account-based sign-in
- Google sign-in
- email magic link fallback
- quiet session restore
- session recovery without data loss
- automatic sync across devices
- durable local persistence on each device
- offline queueing and automatic recovery
- safe migrations

### Core product spine

- Now
- Inbox
- Upcoming
- Review

### Core capture and object behavior

- capture to Inbox without forced classification
- add directly into the current destination when context is already clear
- directed quick add into a chosen target
- create and edit task/note from a captured entry
- support first-class list containers and list items
- complete task
- archive task, note, or preserved capture
- schedule for later
- mark waiting on
- search and retrieve across captures, tasks, notes, and list surfaces

### Day behavior

- focus on what matters today
- end the day cleanly
- carry forward what remains alive
- seed the next day appropriately

### Routine behavior

- support recurring structure without turning the app into a habit system
- routines should reduce repeated thinking, not create management overhead

### Media and context

- attachments
- photos
- voice memos
- item context that survives device changes and bad connections

## V1 quality bar

V1 is not done because the feature list exists. It is done when:

- the app feels trustworthy
- the sync model feels invisible in normal use
- language sounds product-native
- the four core areas feel purposeful and distinct
- the app is harder to lose things in than real life already is
- the app does not feel bloated

## Core area rules

## Now

Purpose:

- the command view for the current day

Must be:

- focused
- active
- quiet
- decisive

Should contain:

- what is relevant today
- focused items
- day context
- fast actions that move the day forward

Must not become:

- a dashboard
- a backlog
- a settings surface
- an analytics surface
- a dumping ground for everything open

## Inbox

Purpose:

- the catch point before full sorting or planning

Must be:

- friction-light
- forgiving
- fast

Should contain:

- newly captured uncertain entries
- lightly shaped tasks and notes
- quick decisions such as keep, schedule, move, archive

Must not require:

- forced categorization up front
- metadata-heavy entry
- planning logic during capture

## Upcoming

Purpose:

- things not for now, but not lost

Must be:

- calm
- structured
- trustworthy

Should contain:

- scheduled items
- planned-later items
- waiting-on states

Must not become:

- a project planner
- a cluttered calendar clone
- a place full of exposed planning mechanics

## Review

Purpose:

- retrieval, reflection, and pattern visibility

Must be:

- useful
- honest
- searchable
- revealing without being noisy

Should contain:

- retrieval
- repeated-loop visibility
- historical context that supports decisions
- refinding across preserved captures, list items, and saved context

Must not become:

- analytics theater
- vanity charts
- a warehouse of dead data with no real decisions attached

## Nice soon after V1

- richer review/history views
- checklist template and run history refinement
- attachment preview improvements
- push or reminder features only if they truly help
- optional exports/backups
- better surfaced recovery states if sync problems are real enough to need UI

## Not in V1

- collaboration or shared workspaces
- kanban or board views
- giant label/tag systems
- heavy custom views
- automation engines
- habit-tracker bloat
- social/community features
- "AI assistant inside the app" features
- settings that mostly expose implementation detail

## Anti-scope rules

If a proposed feature:

- makes Holdfast feel more like a productivity platform
- increases user-administered complexity
- adds settings instead of stronger defaults
- explains the system instead of improving the system
- turns any core area into a generic pattern from task apps

then it should be rejected until proven necessary.
