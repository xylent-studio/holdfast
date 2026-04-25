# 2026-04-24 36-Voice Product Review

## Status

Completed on 2026-04-24.

This was a structured research pass, not a product decision by itself.

Outputs:

- 1 operator review
- 30 broad persona reviews
- 5 Justin-adjacent persona reviews derived only from expressed product preferences in-thread
- 1 dissent audit

## Method

Every reviewer used the same protocol:

1. land on the app and explain first impression of the spine
2. try fast capture with Add
3. route something through Inbox
4. work something in Now
5. use Upcoming in at least one section
6. use a list surface, including whole-list activation if relevant
7. try retrieval in Review
8. inspect Settings, account, and sync language
9. separate broken-feeling issues from product-model disagreements

Common reviewer output fields:

- `what_feels_right`
- `what_breaks_flow`
- `change_remove_improve`
- `trust_worries`
- `would_use_this_now`
- `severity_calls`

## Important evidence caveat

The current local build at [http://127.0.0.1:4174](http://127.0.0.1:4174) resolved every checked route to the signed-out auth landing during this pass.

That means the review set is based on:

- real first-run signed-out behavior from the local build
- route checks on local build
- selective production/staging calibration for auth, sync, and trust posture
- current code, docs, and tests for the in-app flows that the local first-run could not fully exercise

Do not treat every first-run complaint as proof that the underlying product model is wrong.

## Operator review

### Would I use this now?

`maybe`

### Why

The product model is stronger than the lived first-run.

What I would want as a real user:

- text-first Add
- whole-list activation
- retrieval-first Review
- clear `Now / Inbox / Upcoming / Review / Lists` boundaries

What still gets in the way:

- first-run auth hides the spine
- route intent collapses when signed out
- list surfaces still carry too much management chrome in places
- mobile action density is still too high
- some trust and settings language still leaks support or implementation posture

## Executive summary

1. The strongest recurring finding was not that the spine is wrong. It was that the spine is hidden too early.
2. Holdfast's underlying model tested better than its first-run presentation.
3. Whole-list activation is a real product advantage and should be protected.
4. Text-first Add is one of the strongest parts of the product and should not be complicated.
5. Review is strong at directed retrieval but still lighter than some users want for passive refinding.
6. List detail is the biggest concentration of managerial/control-density risk.
7. Mobile interaction cost is still too high in Inbox, Add destination picking, list runs, and shared action rows.
8. Scheduling needs to be more explicit where it still relies on default dates like tomorrow.
9. Sync/account posture is calmer than most apps, but the product surface still does not fully earn its strongest trust claim on first run.
10. The main synthesis risk is flattening Holdfast into a more generic task app in response to friction that is often about presentation, sequencing, and density rather than product meaning.

## Strong signals to protect

- `Now / Inbox / Upcoming / Review / Lists`
- text-first Add with `Save to Inbox`
- whole-list activation and true list runs
- explicit list finish outcomes
- Review as retrieval-first, not a dashboard
- separation between quiet list library access and retrieval
- calm sync language like `Saved offline`, `Can't sync yet`, and `Couldn't sync yet`
- the refusal to convert everything into tasks

## What to change next

### High-confidence changes

- preserve route intent and product meaning before or during signed-out entry
- reduce control density on list and mobile surfaces
- remove silent default scheduling where the user did not actually choose the date
- push diagnostics and support posture deeper in Settings
- tighten reference-list behavior so shelves feel calmer than project-like lists
- improve list/run wording where labels still describe mechanics instead of outcomes

### Good next hypotheses

- add a route-aware signed-out shell or equivalent first-run proof path without adding onboarding theater
- compact mobile action rows so the first likely tap is obvious and larger
- make Review slightly better at passive refinding without turning it into a dashboard
- clarify what is safe locally versus what has completed a healthy sync

## What to remove or de-emphasize

- always-visible schedule forms at the top of list pages
- duplicate overdue emphasis across multiple surfaces
- implementation-scented primary labels like `Convert to list item`
- support/debug posture in the first layer of Settings
- `Create task` prominence on replenishment or reference-style list items
- excessive helper text where action labels and layout should carry the meaning

## Polarizing issues

### Signed-out posture

Most reviewers wanted more value before auth.

The dissent warning: do not solve this with sample-data theater or generic onboarding.

### Upcoming balance

Some users felt `Upcoming` still leads too hard with `Scheduled`.
Others cared more that scheduling is still too implicit in fast paths.

This is a real design tension, not fake consensus.

### Overdue tone

Some users wanted overdue visibility to stay explicit but calm.
Others wanted overdue to be much less foregrounded.

### Review breadth

Many reviewers liked Review being retrieval-first.
Some wanted stronger passive memory-jogging or refinding help.

This must be handled carefully to avoid dashboard creep.

## Theme map

Counts are approximate and are meant to show direction, not legal precision.

| Theme | Classification | Broad frequency | Justin-adjacent frequency | Notes |
| --- | --- | ---: | ---: | --- |
| Auth-first local first-run hides the spine | bug/change | ~29/30 | 5/5 | strongest repeated finding |
| Signed-out route collapse weakens route meaning | bug/change | ~20/30 | 4/5 | closely related to first-run issue |
| List surfaces feel too managerial or too dense | change | ~16/30 | 4/5 | especially on mobile and in list detail |
| Mobile tap/action density is too high | bug/change | ~8/30 | 3/5 | physical usability issue, not core model issue |
| Settings/trust copy still leaks internal posture | remove/change | ~12/30 | 4/5 | mostly presentation and wording |
| Scheduling is too implicit in some fast paths | change | ~8/30 | 2/5 | especially silent tomorrow defaults |
| Review needs lighter passive refinding support | improve-later | ~7/30 | 1/5 | must avoid dashboard behavior |
| Reference lists need calmer shelf behavior | change | ~5/30 | 2/5 | real product distinction still under-felt |
| Sync/account model is good but not fully earned from surface | change | ~4/30 | 3/5 | stronger in trust-focused personas |

## Broad persona summary

| ID | Persona | Would use now? | Strongest keep | Strongest issue |
| --- | --- | --- | --- | --- |
| 1 | Mobile-first context-switching solo operator | maybe | calm core promise | auth-first first run |
| 2 | Grocery and replenishment runner | maybe | whole-list shopping run | replenishment surfaces too control-heavy |
| 3 | Busy household logistics user | maybe | Upcoming/Review structure | auth-first and managerial list tone |
| 4 | Student with deadlines and notes | maybe | retrieval and note support | silent scheduling defaults |
| 5 | Freelancer juggling client/admin/life | maybe | calm personal tone | first-run trust and Review passivity |
| 6 | Less-technical trust-first user | maybe | calm trust copy | route collapse and internal wording |
| 7 | Note-keeper and saver of important details | maybe | retrieval/library posture | reference lists still too action-first |
| 8 | Receipt/document saver | maybe | retrieval of receipts/screenshots | no rich attachment preview |
| 9 | Creative idea catcher with attachments | no | raw capture model | auth-first and attachment capture still too post-hoc |
| 10 | Search-first refinder | maybe | Review/refinding model | live refinding loop blocked and item match explanation partial |
| 11 | Cross-device continuity-sensitive user | no | recovery and wrong-account posture | continuity trust not yet fully earned |
| 12 | Privacy-conscious low-overhead user | maybe | calm recovery language | account-first feel and internal wording |
| 13 | Date-driven planner | maybe | explicit scheduled model | silent tomorrow scheduling and auth-first entry |
| 14 | Calm undated-backlog keeper | maybe | undated/backlog protection | schedule-first entry and date creep |
| 15 | Waiting-on heavy user | no | honest Waiting on state | waiting integrity under-supported in Review |
| 16 | Appointment-and-errand coordinator | maybe | clear route-owned movement verbs | mobile scheduling still too assumptive |
| 17 | Irregular-schedule user | maybe | low-pressure future model | dates still get too much default emphasis |
| 18 | Travel and packing checklist user | maybe | whole-list runs and finish choices | reusable-run history still too hidden |
| 19 | Replenishment shopping user | maybe | active grocery run model | mobile run surfaces too management-heavy |
| 20 | Recurring checklist runner | maybe | finish/reset model | prior-run history not surfaced clearly |
| 21 | Home maintenance / chores user | maybe | scheduled whole-list chores | recurrence model too weekday/admin-heavy |
| 22 | One-off project list user | maybe | explicit non-duplicate list model | Add-to-list and list header too dense |
| 23 | Reference-list keeper | maybe | quiet list library intent | no clean reference-list creation path |
| 24 | Side-hustle personal-ops user | maybe | personal operational spine | auth-first and settings/system posture |
| 25 | High-volume capture user | maybe | raw capture path | Inbox gets too tall and admin-heavy fast |
| 26 | Low-volume occasional user | maybe | calm retrieval and settings | re-entry still too structurally heavy |
| 27 | Pressure-sensitive user | no | humane capture/Upcoming/Review defaults | overdue surfaces still too explicit |
| 28 | Mobile ergonomics hawk | maybe | good mobile auth shell and stacked Add footer | sub-44px actions and dense rows |
| 29 | Language/design-sensitive user | maybe | strong spine naming and calm tone | list surfaces and some labels drift into mechanics |
| 30 | Skeptical ex-task-app user | maybe | differentiated model | first-run makes app look more ordinary than it is |

## Justin-adjacent appendix

These five personas were derived only from product preferences already expressed in-thread, not from demographic assumptions.

### Persona 31 - Trust-and-sync hardliner

- keeps: local-first posture, calm recovery language, human sync states
- wants: stronger proof of what is safe locally and what has truly synced
- strongest issue: strongest trust claims are not yet fully earned from the surface

### Persona 32 - Anti-bloat product purist

- keeps: disciplined spine, text-first Add, retrieval-first Review
- wants: less visible control density in `Now`, `ListView`, and `Settings`
- strongest issue: surface accretion is the main anti-bloat risk now

### Persona 33 - Stable-daily-driver skeptic

- keeps: plain language and coherent product model
- wants: boring reliability before advanced nuance
- strongest issue: first-run and hosted trust feel too manual/gated for daily-driver confidence

### Persona 34 - List-run realism user

- keeps: whole-list activation, crossed-off visibility, explicit finish outcomes
- wants: list runs to feel more direct and less controlled on phone
- strongest issue: mobile run surfaces still carry too much management chrome

### Persona 35 - Mobile-first friction critic

- keeps: clean mobile landing and restrained Review/Settings collapse behavior
- wants: fewer taps, fewer stacked controls, less top-bar competition
- strongest issue: too much mobile friction in Inbox, Add destination picking, and list runs

## Dissent audit

### Main challenge

The review set can easily overreact to the auth-blocked local build and conclude that the product model is weaker than it really is.

### What the dissent audit said to protect

- whole-list activation
- text-first Add
- explicit list finish outcomes
- retrieval-first Review
- the distinction between scheduled, undated, and waiting
- the refusal to turn everything into generic tasks

### What the dissent audit warned against

- solving auth-first friction with onboarding theater or sample-data mode
- flattening important distinctions just because some reviewers found them complex
- turning Review into a dashboard
- removing explicit list semantics to make lists look simpler
- adding more explanation chrome instead of making surfaces more legible

## Recommended next experiments

These are candidate next moves, not settled truth.

1. **Signed-out route identity experiment**
   Preserve route meaning and product context before auth without turning first-run into a tour.

2. **Mobile control compaction pass**
   Start with Inbox routing, Add destination picking, active list cards, and list detail headers.

3. **Scheduling explicitness pass**
   Remove silent tomorrow defaults and make date choice more clearly user-authored.

4. **Reference list discipline pass**
   Add direct reference-list creation and calm down shelf surfaces.

5. **Review precision pass**
   Improve match reasons and row-jump wording, then reassess whether passive refinding still feels lacking.

6. **Trust surface cleanup**
   Separate normal user trust surfaces from diagnostics and support posture more aggressively.

## What this review should not be used for

Do not use this review to justify:

- more dashboard surfaces
- more onboarding explanation
- more feature sprawl in `Settings`
- flattening list kinds into a generic system
- weakening explicit list finish outcomes
- turning Holdfast into a calendar-first or PM-tool-first app

## Linked source surfaces

- [docs/product.md](/C:/dev/GitHub/Holdfast/docs/product.md)
- [docs/core-flows.md](/C:/dev/GitHub/Holdfast/docs/core-flows.md)
- [docs/control/interaction-model.md](/C:/dev/GitHub/Holdfast/docs/control/interaction-model.md)
- [docs/control/state-and-transitions.md](/C:/dev/GitHub/Holdfast/docs/control/state-and-transitions.md)
- [docs/control/ui-language-guide.md](/C:/dev/GitHub/Holdfast/docs/control/ui-language-guide.md)
- [docs/control/agent-review-rubric.md](/C:/dev/GitHub/Holdfast/docs/control/agent-review-rubric.md)
- [docs/auth-and-accounts.md](/C:/dev/GitHub/Holdfast/docs/auth-and-accounts.md)
- [docs/deployment.md](/C:/dev/GitHub/Holdfast/docs/deployment.md)
