# Tabletop Card Studio — refactor + UX overhaul

Date: 2026-11-05 · Branch: `refactor/ux-overhaul` · Base: `e350c21`

## Goals

1. Split the two monoliths (`src/App.tsx` 8.3k lines, `electron/main.ts` 3.3k lines after formatting) into focused modules so later changes are cheap and safe.
2. Make the Tabletop Creator sync trustworthy: never silently stop syncing.
3. Remove the main editing friction: no undo, no bulk edit, no editor navigation, weak keyboard support.

Non-goals: visual redesign, new data model, changes to Excel import/merge semantics, changes to Git/GitHub features.

## Constraints

- Behaviour-preserving refactor first (phase 2): IPC channel names, preload API, on-disk formats and UI text stay identical.
- Target file size < 300 lines (hard ceiling 400 for JSX-heavy views). Prefer small functions; do not chase the 30-line rule on JSX at the cost of readability.
- No new runtime dependencies. Dev dependencies added: `prettier`, `vitest`.
- Formatting: `npm run format` (Prettier, no semicolons, single quotes, width 120).

## Verification gates (every phase, every agent)

- `npm run typecheck` and `npx tsc -p tsconfig.electron.json --noEmit` clean.
- `npm test` green.
- `npx vite build` succeeds.
- Smoke test (outside repo): build electron + renderer, then
  `node <scratchpad>/smoke/smoke.mjs <worktree> <label>` — launches the real app on a copy of a real project, imports the Excel, visits all views, opens the card editor, fails on any page/console error.

## Phase 1 — tooling (done)

Prettier + Vitest added, sources formatted. Verified: electron output byte-identical after minification; renderer differs only in JSX whitespace children (same rendered text).

## Phase 2 — split

### 2a (parallel)

- **R1 renderer move.** Move every top-level declaration out of `App.tsx` into modules, no logic changes:
  - `src/lib/` — pure helpers (table column constants, slug, asset references, blueprint geometry/text helpers, formatting, guessType, makeDistribution).
  - `src/components/fields/` — IconPreview, VariableTextPreview, InlineTableCell, ColorField, ImageField, VariableField, VariableInsert, IconVariableInsert, VariableTagPicker, DefaultValueEditor, ConditionalRulesEditor.
  - `src/components/dialogs/` — RenameSet, NativeNameConflict, MoveCard, ExportChoice, NativeSetLink, IconLibrary.
  - `src/components/import/` — ImportLanding, ImportWizard, MergeWizard.
  - `src/components/cards/` — CardEditor, CardBlueprintPreview, BlueprintPanelPreview, BlueprintTextPanelContent.
  - `src/views/` — ProjectChooser, ProjectSettingsPage, AssetsPage, VariablesPage (+ VariableTagEditor, VariableEditorCard), ColumnsPage, StatisticsPage, GitHubPage, Markdown (Page, Workspace, Preview).
  - `App.tsx` keeps only the `App` component.
- **E1 electron split.** Module-level mutable state moves to `electron/state.ts` (one exported mutable object). Modules: `diagnostics`, `store` (split set store + persistSets), `workbooks` (scan/import/merge/export), `native` (native sets read/write/hash), `assets` (assets + icons), `variables`, `blueprints`, `project` (open/list/set operations), `git`, `github` (auth, API, repo create/clone), `ipc` (handler registration), `main.ts` (bootstrap only).
- **T1 tests.** Vitest unit tests for the existing pure modules (`src/conditional.ts`, `src/generatedIds.ts`).

### 2b (parallel, after R1)

Decompose oversized components into sub-components/hooks, each agent owning disjoint files:
- App → hooks (`useProject`, `useCardFilters`, `useTableColumns`, `useGitStatus`, …) + `CardsView`, `Sidebar`, `TopBar`.
- GitHubPage, MarkdownWorkspace.
- ColumnsPage, ConditionalRulesEditor, VariablesPage.
- ProjectChooser, MergeWizard, ImportWizard, CardEditor.

### 2c (manager)

Single mutation funnel for cards in the renderer: `commitCards(next: Card[], label: string): Promise<void>`. Every code path that calls `window.cardCms.saveCards` goes through it. Phase 3 builds on it.

## Phase 3 — features (parallel)

### S. Native sync reliability (electron + banner)

Today: if the Tabletop Creator set file changes while Card Studio is open, every later sync of that file is skipped and the user is told once per session. Card Studio does not watch files.

Design:
- Track per linked set `nativeSyncPending: boolean` (persisted with the set): true when a CMS change could not be written to the native file.
- Watch `data/sets/` of the open project (`fs.watch`, debounced 300 ms; ignore events caused by our own writes by comparing the file hash with the last hash we wrote).
- On external change of a linked file:
  - no pending CMS changes for the sets in that file → reload those sets from the native file automatically (same merge semantics as linking: native fields refresh, Card Studio-only metadata — tags, status, CMS-only columns — preserved) and send a toast "Aggiornato da Tabletop Creator".
  - pending CMS changes → conflict. Do not write. Mark the sets `conflict`.
- Same check at project open (file changed while the app was closed).
- Snapshot exposes `nativeSync: Record<setId, 'synced' | 'conflict' | 'error'>`.
- Renderer: persistent banner on the cards view of a conflicted set and a warning dot on the set in the sidebar. Actions: **Ricarica da Tabletop Creator** (discard pending CMS-side native fields, reload) and **Sovrascrivi Tabletop Creator** (write CMS version; first copy the native file to `.tabletop-card-studio/native-backups/<file>.<timestamp>.json`). Both clear the conflict.
- The once-per-session toast is removed.
- Pure logic (decide action from hashes/pending, merge reload) unit-tested.

A three-way "compare" UI is out of scope (YAGNI): the two actions plus the automatic backup cover the cases without a new screen.

### U. Undo/redo + card editor navigation

- History lives in the renderer inside `commitCards`: stack of `{ setId, label, before: Card[], after: Card[] }`, max 50, redo stack cleared on new commit, both cleared when the project changes. Entries for another set are skipped/dropped when undoing (only undo the active set; switching set keeps its own stack — keyed by setId).
- Undo = `saveCards(before)`; redo = `saveCards(after)`. Toast "Annullato: <label>" with a **Ripristina** action.
- Shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y — ignored while focus is in an input/textarea/contenteditable (native text undo wins there).
- Scope: card changes only (inline edit, editor save, create, delete, bulk edits). Columns, variables, imports and Git are not undoable. Moving a card to another set is not undoable either (cross-set, goes through `moveCard`, not the funnel; YAGNI).
- A columns save clears the history of the active set (old snapshots may not fit the new columns). Undo/redo refuses, and drops the set's history, when the set's cards no longer equal the entry's expected state (changed outside the funnel: move, import, merge, native reload).
- Shortcuts are active on the cards view only, also ignored while a dialog other than the card editor is open; checkboxes/buttons do not count as text fields.
- Card editor: **precedente/successiva** buttons following the current filtered/sorted order, Alt+↑/↓ shortcut, Ctrl/Cmd+S saves. Navigating with unsaved changes saves first (undoable).

### B. Bulk edit + table keyboard navigation

- Selection column with checkboxes; header checkbox selects all filtered cards; shift-click selects a range. Selection clears on set/filter change.
- Action bar when ≥1 selected: set status, add tag, remove tag, set field value (field picker + value input using the field's editor), delete (with inline confirmation). Each action = one `commitCards` call = one undo step.
- Keyboard: ↑/↓ moves a focused row, Enter opens the card editor, Space toggles selection, Escape clears selection; Ctrl/Cmd+F focuses search. Inline cell editing: Enter saves, Escape cancels, Tab/Shift+Tab saves and moves to the next/previous editable cell of the row.

## Merge strategy

Each agent works in its own git worktree on its own branch and commits there; the manager merges into `refactor/ux-overhaul` in order, re-running all gates after each merge. No pushes, no changes to `main` without the owner's approval.
