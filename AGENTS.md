# AGENTS

Treat this repo as a real product codebase, not a demo.

## Read First

0. If this machine has the local intel workspace, run `C:\dev\_intel\scripts\Resolve-AgentContext.ps1 -TargetPath C:\dev\GitHub\Holdfast` before deeper work.
1. [docs/control/docs-index.md](/C:/dev/GitHub/Holdfast/docs/control/docs-index.md)
2. [docs/product.md](/C:/dev/GitHub/Holdfast/docs/product.md)
3. [docs/core-flows.md](/C:/dev/GitHub/Holdfast/docs/core-flows.md)
4. [docs/architecture.md](/C:/dev/GitHub/Holdfast/docs/architecture.md)
5. [docs/auth-and-accounts.md](/C:/dev/GitHub/Holdfast/docs/auth-and-accounts.md)
6. [docs/data-model.md](/C:/dev/GitHub/Holdfast/docs/data-model.md)
7. [docs/deployment.md](/C:/dev/GitHub/Holdfast/docs/deployment.md)

The files in [docs/control](/C:/dev/GitHub/Holdfast/docs/control) are the governing product contract. If code, docs, or naming conflict with them, surface the conflict explicitly and resolve it on purpose.

Machine-local `_intel` outputs are supplemental context only. They can help with continuity and handoff on this machine, but they do not override repo docs, code, or the control contract.

## Product Rules

- Do not genericize Holdfast into a broad productivity suite.
- Preserve the `Now / Inbox / Upcoming / Review` spine.
- Design for signed-in sync as the normal experience.
- Let first-run guest use feel immediate, then upgrade that workspace into a real account without data loss.
- Keep offline behavior strong and quiet.
- Keep capture fast and settings minimal.
- Treat attachments, photos, and voice memos as first-class product data.
- Never store attachments inline in `localStorage`.
- Do not rebuild product logic inside giant UI files.

User-facing language uses `Now`. The current storage/model alias remains `today` until a deliberate schema migration changes it. Do not confuse those layers.

## Working Boundaries

- `src/domain`: product language, schemas, selectors, date logic, close-day logic
- `src/storage/local`: IndexedDB tables, bootstrapping, write commands, snapshot assembly
- `src/storage/sync`: sync contracts and provider boundaries
- `src/features`: route-level flows and dialogs
- `src/app`: shell, routing, top-level state

If a change affects product meaning or persistence semantics, start in `src/domain` or `src/storage`, not in a component.

## Tooling Baseline

- Prefer `rg` for search. It is installed and working in this workspace.
- Use the project-local Wrangler CLI via `npx wrangler` or `npm run cf:*`.
- Use the project-local Supabase CLI via `npx supabase` or `npm run supabase:*`.
- GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe`, but may require a fresh shell to appear on `PATH`.
- `gh` auth is currently configured on this machine. Re-check with `gh auth status` if a later shell behaves differently.
- `wrangler` auth is currently configured on this machine. Re-check with `npm run cf:whoami` before relying on Pages or DNS actions from a new shell or environment.
- Docker is not installed, so `supabase start` will not work until a Docker-compatible runtime is added.
- The `_intel` scripts live outside this repo. Use them when present on this machine, but do not make repo work depend on them being portable.

## Search Strategy

Preferred ripgrep anchors:

- `rg "Now|Inbox|Upcoming|Review" src docs`
- `rg "guest|anonymous|member|authState|identityState" src docs`
- `rg "'today'|status: 'today'|destination: 'today'" src/domain src/storage`
- `rg "ItemRecord|DailyRecord|RoutineRecord|MutationRecord" src/domain src/storage`
- `rg "toggleFocus|startDay|closeDay|createItem|saveItem" src`
- `rg "prototype|migration|carry|control" docs src`

High-signal files:

- [src/domain/schemas/records.ts](/C:/dev/GitHub/Holdfast/src/domain/schemas/records.ts)
- [src/domain/logic/selectors.ts](/C:/dev/GitHub/Holdfast/src/domain/logic/selectors.ts)
- [src/storage/local/api.ts](/C:/dev/GitHub/Holdfast/src/storage/local/api.ts)
- [docs/control/product-charter.md](/C:/dev/GitHub/Holdfast/docs/control/product-charter.md)
- [docs/control/state-and-transitions.md](/C:/dev/GitHub/Holdfast/docs/control/state-and-transitions.md)
- [docs/architecture.md](/C:/dev/GitHub/Holdfast/docs/architecture.md)
- [docs/auth-and-accounts.md](/C:/dev/GitHub/Holdfast/docs/auth-and-accounts.md)
- [docs/data-model.md](/C:/dev/GitHub/Holdfast/docs/data-model.md)
- [docs/deployment.md](/C:/dev/GitHub/Holdfast/docs/deployment.md)

## Required Workflow For Meaningful Changes

1. Confirm the governing control docs still support the change.
2. Update or confirm the domain model.
3. Update local persistence or mutation logging if write semantics change.
4. Keep feature code thin and product-specific.
5. Add or update tests when behavior changes.
6. Update docs if product rules, flows, architecture, or naming changed.
7. When the local intel workspace is available, write a checkpoint with `C:\dev\_intel\scripts\Write-AgentCheckpoint.ps1 -TargetPath C:\dev\GitHub\Holdfast -TaskType code -Summary "..."` after a pass that materially changes product, storage, auth, sync, or deployment behavior.

## Current Gaps To Respect

- Voice memo recording and dictation from the prototype are not yet ported.
- Supabase auth, remote schema, storage policies, and browser sync foundation are wired, but hosted provider setup, broader multi-device validation, and richer conflict handling are still incomplete.
- Prototype recovery import and workspace backup export are available, but current-workspace restore/import and richer attachment preview are not yet ported.
- The schema still uses `today` as the stored state key for user-facing `Now`.

Do not improvise around those gaps. Implement them deliberately or document them.

## Source References

- archived prototype: [archive/prototype/holdfast_proto_2026-04-18.html](/C:/dev/GitHub/Holdfast/archive/prototype/holdfast_proto_2026-04-18.html)
- archived manager drop: [archive/manager-inputs/2026-04-18_holdfast_control_pack_v2](/C:/dev/GitHub/Holdfast/archive/manager-inputs/2026-04-18_holdfast_control_pack_v2)
