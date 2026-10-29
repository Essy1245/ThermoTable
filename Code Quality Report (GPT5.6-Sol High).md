# ThermoTable Code Quality and Optimization Report

**Project reviewed:** `ThermoTable`  
**Review model:** GPT-5.6-Sol High  
**Review date:** October 29, 2026  
**Scope:** Static code review, architecture review, lint, TypeScript build, and production bundle inspection

## Executive Summary

The project has a sensible typed data model, generally follows immutable React state-update patterns, and currently passes both linting and the production build. The main optimization limitation is scalability: all thermodynamic data is included in the initial JavaScript bundle, while most interface state and four distinct table renderers are concentrated in one large React component.

The highest-value changes are:

1. Load thermodynamic tables on demand.
2. Stop driving table hover effects through top-level React state.
3. Render pinned pressure blocks only once.
4. Store synchronized temperature pins per table.

Together, these changes should materially reduce initial download and parse costs, React reconciliation work, DOM size, and state-related defects.

## Architecture Overview

TabTab is a client-side React 19 application built with Vite and Tailwind CSS. Its thermodynamic data is stored as statically typed TypeScript objects under `src/data/tables`.

The main application component currently manages:

- Active-table selection and search
- Temperature and pressure units
- Visible property categories
- Pinned rows, columns, pressure blocks, and temperatures
- Hovered rows and columns
- Jump-to-value behavior and scrolling refs
- Tooltips and global keyboard behavior
- Rendering for saturated, superheated/compressed, ideal-gas-air, and ideal-gas-molar tables
- Opening and configuring the image-snippet workflow

The snippet feature builds selected rows and columns in `SnippetModal.tsx`, then generates a high-resolution PNG using `renderSnippetCanvas.ts`.

## Validation Results

- `npm run lint`: passed with no reported errors.
- `npm run build`: passed.
- Production JavaScript: **668.61 kB minified / 173.94 kB gzip**.
- Vite reports that the JavaScript chunk exceeds its 500 kB warning threshold.
- The table source files contain approximately **974 kB** of uncompressed TypeScript data.
- No automated test suite is configured.

## Findings

### 1. High — Every thermodynamic dataset is eagerly bundled

`src/data/tables/index.ts` statically imports all 17 thermodynamic tables and places them in a synchronous `TABLES_MAP`, even though the interface displays only one table at a time.

This design is the principal reason the production build emits a single 668.61 kB minified JavaScript chunk. It increases initial network transfer, JavaScript parsing, module initialization, and retained memory.

**Recommendation:**

- Replace the synchronous map with per-table dynamic import loaders.
- Load A-4 as the initial table and fetch other datasets when selected.
- Cache resolved table modules so revisiting a table is instantaneous.
- Optionally prefetch a table when its switcher entry is hovered or focused.
- Lazy-load the snippet modal and canvas renderer because they are not required for the initial view.

Example target structure:

```ts
const tableLoaders = {
  'A-4': () => import('./tableA4'),
  'A-5': () => import('./tableA5'),
  // ...
};
```

### 2. High — Hovering causes application-wide React renders

`handleRootMouseMove` finds the row and column under the pointer and stores both in top-level React state. Moving between rows or columns therefore causes the complete `App` component to execute again and reconstruct the table element tree.

This is particularly costly for Table A-6, which contains 545 rows across 36 pressure blocks. `React.memo(Td)` reduces some cell commits, but it does not stop the parent component from recreating thousands of React elements and comparing their props.

**Recommendation:**

- Implement ordinary row hover using CSS `:hover` styles.
- Isolate column-hover behavior into a smaller component or narrowly scoped context.
- Memoize individual pressure-block and row components.
- Consider row/block virtualization for the largest tables.
- As a simpler intermediate improvement, apply `content-visibility: auto` to off-screen pressure cards.

### 3. High — Pinned pressure blocks are rendered twice

A pinned pressure block is rendered in the dedicated “Pinned Isobars” section and then rendered again in the “All Isobars” grid. This duplicates every header, row, cell, event handler, and React element in that block.

Both copies also write identical row keys into `rowRefs`. As a result, jump-to-row behavior depends on which ref callback last assigned that key.

**Recommendation:**

- Render each block exactly once.
- Sort pinned blocks before unpinned blocks in one unified grid, or exclude pinned blocks from the lower grid.
- Extract a shared `PressureBlock` component so block markup has one implementation.

### 4. High — Synchronized temperature pins leak between tables

Rows, columns, blocks, collapsed blocks, and disabled blocks are stored per table. `pinnedTemps`, however, is a single global `Set<string>`.

For example, selecting `T = 200` in A-6 can silently highlight rows with the same display string after switching to A-7 or A-13. The leaked state also affects snippet counts and the page-unload warning. This contradicts the documented per-table persistence model.

**Recommendation:**

Replace the global set with table-scoped state:

```ts
Record<string, Set<string>>
```

Access and update the set through the current table ID, consistent with the existing pinned-row and pinned-block state.

### 5. High — The global Tab shortcut breaks keyboard navigation

The application installs a document-level keyboard handler that cancels Tab whenever the immediate target is not an input, select, or textarea. This prevents keyboard users from tabbing normally through buttons and other interactive controls.

The behavior is both an accessibility defect and a maintenance risk because new controls inherit the broken navigation automatically.

**Recommendation:**

- Retain `Ctrl/Cmd+K` as the explicit table-search shortcut.
- Do not use bare Tab to open the switcher.
- Only manage Tab while a modal or popup that intentionally contains focus is open.
- Use appropriate menu/dialog semantics and return focus to the invoking control on close.

### 6. Medium — Snippet changes regenerate and encode the complete image

Every selected-column, pressure-block, or emphasized-cell change invokes the complete 3× canvas renderer. The resulting canvas is PNG-encoded twice: synchronously as a base64 data URL and asynchronously as a Blob.

This retains a canvas pixel buffer, a base64 string, and a Blob at the same time. Large snippets can therefore cause main-thread pauses and unnecessary memory use.

**Recommendation:**

- Render the table content once and draw emphasis on a separate overlay canvas.
- Generate only a Blob for preview and export.
- Preview the Blob with `URL.createObjectURL` and revoke old URLs during cleanup.
- Debounce rapid configuration changes.
- Consider `OffscreenCanvas` or a worker if snippet rendering becomes substantially more complex.

### 7. Medium — Modal emphasis initialization can use stale or empty rows

When the snippet modal opens, one effect initializes the active pressure blocks. A second effect initializes emphasized intersections from `rowGroups`, but that second effect depends only on `isOpen`.

On the first opening, the active block set can still be empty when the emphasis effect runs. The active blocks then populate and `rowGroups` updates, but the emphasis initializer does not run again. Highlighted intersections may consequently be missing from the initial snippet.

**Recommendation:**

- Initialize modal state atomically for each open session, or
- Reinitialize emphasis once the opening session’s row groups are ready.
- Remove the suppressed exhaustive-dependencies warning and express the intended dependency behavior explicitly.

### 8. Medium — The main component has overly broad responsibilities

`App.tsx` is 1,741 lines and combines application state, global events, navigation, formatting, scrolling, and four separate table renderers. Superheated pressure-block markup is duplicated between pinned and ordinary displays.

This structure creates broad render boundaries, makes behavioral changes difficult to test in isolation, and increases the chance that a small state change affects unrelated interface sections.

**Recommendation:**

Extract at least the following components:

- `TableSwitcher`
- `JumpControl`
- `SaturatedTableView`
- `IsobarTableView`
- `PressureBlock`
- `IdealGasAirTableView`
- `IdealGasMolarTableView`

Consolidate the parallel per-table state records into a reducer with a typed table UI-state object. This will make transitions such as switching, clearing, pinning, and disabling blocks easier to reason about and test.

### 9. Medium — No automated tests protect scientific data or interactions

The project has lint and build scripts but no test command or test files. This makes data compaction, code splitting, component extraction, and state restructuring unnecessarily risky.

For an engineering-reference application, silent data or unit-conversion regressions are more consequential than ordinary presentation defects.

**Recommendation:**

Add a focused test baseline covering:

- Required property fields for each table type
- Monotonic temperature and pressure indexes
- Unique pressure blocks
- Representative source values and preserved significant figures
- Celsius/Kelvin and kPa/MPa/bar conversions
- Nearest-value jump selection
- Per-table pin isolation
- Snippet row and column selection
- First-open snippet emphasis
- Keyboard navigation

## Suggested Implementation Order

### Phase 1 — Correctness and accessibility

1. Scope `pinnedTemps` by table.
2. Remove the global Tab interception.
3. Fix snippet initialization dependencies.
4. Add regression tests for these behaviors.

### Phase 2 — Rendering performance

1. Stop duplicating pinned pressure blocks.
2. Extract and memoize `PressureBlock` and row components.
3. Move row hover to CSS and narrow column-hover updates.
4. Add `content-visibility` or virtualization where measurements show it is beneficial.

### Phase 3 — Delivery and snippet performance

1. Dynamically import table datasets.
2. Lazy-load the snippet feature.
3. Replace base64 previews with Blob URLs.
4. Split base-table rendering from emphasis rendering.

### Phase 4 — Maintainability

1. Extract the four table views and application controls.
2. Consolidate table UI state into a reducer.
3. Add component and integration tests around the extracted boundaries.

## Positive Observations

- The discriminated `ThermoTableData` union gives the render paths useful type narrowing.
- `ThermoValue` deliberately preserves both numeric and source-string representations, which is appropriate for calculations and significant-figure display.
- State sets are generally copied before mutation.
- Event listeners installed by effects are generally removed correctly.
- The current code passes linting and TypeScript compilation.
- The canvas renderer is separated from modal controls, providing a reasonable starting boundary for further optimization.

## Final Assessment

The application is functional and builds cleanly, but its architecture is optimized for a small static prototype rather than for increasing dataset and interaction complexity. The code can be optimized substantially without changing the visible product design.

Issues 1 through 4 should be treated as the first optimization milestone. They offer the strongest combination of user-visible performance improvement, reduced memory and DOM usage, and corrected state behavior.
