# 2026-04-27 Contextual Movement Actions

## Trigger

Inbox placement controls had drifted from the rest of the app. Each Inbox item
rendered a second card underneath it for movement choices, and compact layouts
showed `Now`, `List`, and `More places` while hiding `Schedule`, even though
`Schedule` was the primary placement action in the shared action model.

## Product Decision

Movement controls should be route-owned but rendered through shared primitives.
Inbox now shows one `Place` action on each unsorted item card. `Place` opens a
focused sheet with the canonical destinations:

- `Now`
- `Schedule`
- `List`
- `Keep undated`
- `Waiting on`
- `Archive`

Scheduling still requires explicit confirmation before mutation. List placement
still opens the dedicated list target flow.

## Implementation Guardrails

- Do not reintroduce a second below-card placement surface for Inbox rows.
- Keep movement labels derived from `surface-actions` instead of hardcoding them
  inside route components.
- Keep no-op movement wording contextual: `Keep in Inbox`, `Keep scheduled`,
  `Keep undated`, and `Keep waiting`.
- Use the shared action renderer for route-owned movement footers where practical.

## Validation Notes

Targeted browser QA covered Inbox at 320, 360, 390, 430, 768, and 1280 pixels.
The new surface had no horizontal overflow, no two-row bottom navigation, and no
console errors in the checked flows.

Production-bundle route QA also covered `/now`, `/inbox`, `/upcoming`,
`/review`, `/lists`, and `/settings` across the same widths, plus the Inbox
`Add -> Place` path. No route stayed on boot, overflowed horizontally, or showed
the old below-card placement surface.

Remaining non-blocker: full hosted validation should still run before production
promotion because this changes primary interaction behavior.
