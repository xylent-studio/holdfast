# Holdfast UI Language Guide

## Purpose
This file exists to prevent the product from sounding like a developer tool, an AI narrator, or a settings panel.

The standard is not “clear enough.”
The standard is “sounds like a real polished app people trust.”

## Voice
Holdfast should sound:
- direct
- calm
- confident
- modern
- human
- restrained

Holdfast should not sound:
- over-explained
- dev-authored
- AI-authored
- bureaucratic
- guru-ish
- mechanically precise at the expense of naturalness

## Core writing rules
- Name the user outcome, not the implementation mechanic.
- Prefer fewer words when the action is already clear.
- Hide system vocabulary whenever possible.
- Do not explain obvious controls.
- Use helper text sparingly and only when it truly reduces uncertainty.
- Let the interaction do as much explanation as possible.
- Avoid marketing tone and avoid sterile admin tone.

## Canonical naming
### Core areas
- **Now**
- **Inbox**
- **Upcoming**
- **Review**

These names are part of the product identity. Do not rename casually.

### Core actions
Prefer:
- Add
- Save
- Done
- Archive
- Schedule
- Move to today
- Plan for later
- Waiting on
- Finish day
- Retry
- Add photo
- Record voice memo

Use with caution:
- Delete
- Reopen
- Keep both

Avoid unless genuinely unavoidable:
- Configure
- Persist
- Sync configuration
- Resolve conflict
- Destination
- Workflow handling
- Queue state
- Rehydrate
- Metadata
- Manage attachments
- Upload pipeline
- Local persistence

## Naming standard
Good names:
- match what a normal user thinks is happening
- match what polished apps tend to say
- point to outcomes
- remain short without becoming vague

Bad names:
- sound like schema fields
- sound like system statuses
- explain the architecture
- read like admin labels
- read like a spec leaked into the UI

## Stress test
Before shipping a label, button, setting, dialog, or helper line, ask:
1. Would this look normal in a polished modern app?
2. Is it naming the user outcome instead of the internal mechanic?
3. Is it shorter than the current version without losing meaning?
4. Does it sound like product language instead of documentation?
5. Would a non-technical user understand it instantly?
6. Is the copy compensating for a weak interaction design?

If a line fails two or more of these, rewrite it.
If a whole screen fails this repeatedly, redesign the interaction instead of piling on copy.

## Copy patterns to prefer
### Buttons
Prefer:
- Save
- Done
- Archive
- Retry
- Add photo
- Remove
- Schedule

Avoid:
- Save item details
- Mark task as completed
- Remove selected attachment
- Persist changes
- Configure upload retry behavior

### Status
Prefer:
- Up to date
- Syncing…
- Saved offline
- Couldn’t sync yet
- Retry

Avoid:
- Local persistence active
- Synchronization state mismatch
- Conflict resolution required
- Attachment queue stalled

### Dialogs
Prefer:
- Discard this memo?
- Archive this?
- Delete this?
- Keep both

Avoid:
- Discard this voice memo draft?
- This action will archive the selected item and remove it from active workflow.
- Changes will be persisted locally and synchronized when connectivity resumes.

### Helper text
Good helper text:
- is brief
- removes real ambiguity
- disappears once the user understands the interaction

Bad helper text:
- explains obvious actions
- narrates the system
- compensates for weak IA or weak control naming

## Settings guidance
The best setting is often no setting.

Expose a setting only when:
- the user gains meaningful control
- the outcome is understandable
- a strong default is not enough

Do not expose settings for:
- sync internals
- storage internals
- upload mechanics
- backend behavior
- architecture decisions
- anything most users should never need to think about

## Screen-specific language guidance

## Now
Language should be:
- active
- clear
- low-friction
- command-oriented

## Inbox
Language should be:
- forgiving
- light
- fast
- non-demanding

## Upcoming
Language should be:
- calm
- structured
- not planner-ish

## Review
Language should be:
- useful
- honest
- retrieval-oriented
- not analytical for its own sake

## Banned patterns
Do not ship wording that sounds like:
- a developer exposing a mechanic
- an AI trying to be extra helpful
- a settings panel explaining itself
- documentation pasted into product UI

When in doubt, cut words first.
