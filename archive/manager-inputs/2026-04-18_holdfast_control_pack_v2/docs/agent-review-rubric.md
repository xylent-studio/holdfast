# Holdfast Agent Review Rubric

## Purpose
This rubric exists to catch the mistakes that matter most: competent-looking output that is wrong for the product.

The goal is not to grade code style in the abstract.
The goal is to decide whether a change makes Holdfast sharper, truer, and more trustworthy.

## Review order
Review in this order:

1. Product truth
2. User trust
3. UX language and interaction quality
4. State/sync correctness
5. Architecture quality
6. Security/privacy sanity
7. Code quality and maintainability

If a patch fails earlier layers, later layers do not save it.

## 1. Product truth
Ask:
- Does this make Holdfast feel more like itself, or more generic?
- Does it preserve the Now / Inbox / Upcoming / Review spine?
- Is it protecting the real product intent or cargo-culting prototype behavior?
- Did the change add productivity-app sludge, dashboard energy, or PM-tool patterns?
- Does this help the user act, trust, and continue — or just add software?

Stop-ship if:
- the product becomes more generic
- a core area loses its purpose
- prototype accidents are treated as product law
- a new feature dilutes the command/review/carry-forward model

## 2. User trust
Ask:
- Would a real user trust this more after the change?
- Is data safer, or merely moving around more?
- Does the UI communicate calm confidence?
- Could anything important silently disappear, duplicate, or go stale?

Stop-ship if:
- data loss is plausible
- cross-device continuity becomes less trustworthy
- the UI creates false confidence
- attachments or voice memos become fragile

## 3. UX language and interaction quality
Ask:
- Do labels sound like a real app?
- Did implementation language leak into the product?
- Is helper text doing too much work?
- Were settings introduced that a strong default should replace?
- Would this feel normal inside a polished contemporary app?

Stop-ship if:
- buttons/settings/dialogs sound dev-authored or AI-authored
- the product starts explaining itself constantly
- settings expose backend mechanics
- user actions become form-like and ceremonial

## 4. State and sync correctness
Ask:
- Are item transitions coherent and stable?
- Does scheduling affect visibility correctly without producing weird clones or duplicates?
- Does waiting on mean something real?
- Does offline behavior stay safe and quiet?
- Does the sync-first experience remain the default perception?

Stop-ship if:
- state transitions become semantically muddy
- two devices can easily produce confusing duplicates
- offline edits can vanish or mislead
- sync feels bolted on
- “done,” “archived,” “upcoming,” and “today” start overlapping weakly

## 5. Architecture quality
Ask:
- Did the change separate real boundaries instead of adding ceremony?
- Is domain logic clearer?
- Is persistence/sync separated from UI appropriately?
- Is the repo easier to search and reason about?
- Would another strong agent understand the system quickly with docs plus ripgrep?

Stop-ship if:
- giant files are returning
- coupling increases without a good reason
- abstractions multiply without real product value
- structure gets more impressive-looking but less understandable

## 6. Security/privacy sanity
Ask:
- Did convenience override a sane trust boundary?
- Is sensitive data exposed in logs, URLs, client state, or debug surfaces?
- Are auth/session assumptions safe enough for the stage of the product?
- Are file/media flows handling trust responsibly?

Stop-ship if:
- dangerous shortcuts are normalized
- secrets or user data can leak
- auth/session behavior undermines trust
- media/file handling is casually unsafe

## 7. Code quality and maintainability
Ask:
- Is the implementation clean enough to keep building on?
- Are tests proving the right things?
- Does naming match the product language?
- Are docs kept aligned with the change?

This matters, but only after the higher layers are sound.

## Highest-priority failure modes to catch
1. semantic drift from the real product
2. generic productivity-app creep
3. AI-sounding language in buttons, settings, empty states, and dialogs
4. sync/offline trust failures
5. state-transition bugs
6. attachment and voice memo fragility
7. security shortcuts disguised as convenience
8. fake-enterprise architecture
9. dead docs that say the right thing while the product drifts elsewhere

## Final decision question
After reviewing a change, ask:

Did this make Holdfast feel more like a real product people can trust,
or did it just add more software?

Only the first one counts as progress.
