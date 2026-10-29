# TabTab: System Architecture & Agent Guide

This document is the definitive engineering reference for TabTab (`thermo-table`). It describes the application's architecture, data models, state management, UI layout engine, canvas image generation subsystem, and development invariants.

> [!NOTE]
> Downstream AI agents and developers should read this document before making architectural changes or extending the table viewing, selection, and snippet generation features.

---

## 1. High-Level Overview

TabTab is an interactive, high-performance reference application for standard engineering thermodynamic property tables (SI units). It enables mechanical and chemical engineers, students, and researchers to:
1. Instantly navigate between 17 thermodynamic tables across 4 distinct topologies (Saturated, Superheated/Compressed, Ideal Gas Air, Molar Ideal Gases).
2. Jump directly to temperatures or pressures via unit-aware lookup (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd>) with automatic row highlight.
3. Highlight/pin specific rows, temperatures, and properties across tables with isolated, per-table state.
4. Compare multiple isobars side-by-side using a unified, responsive grid system.
5. Generate pixel-perfect, copy-paste-ready textbook snippet images immune to dark mode, with auto-packing aspect-ratio optimization and interactive cell emphasis circles.

---

## 2. Directory Layout

```
.
├── DEPLOYMENT.md                        # Static deployment guide (Vercel, Netlify, GitHub Pages)
├── ARCHITECTURE.md                      # This architecture & agent guide
├── README.md                            # Project overview, installation, and user features
├── Property_Tables_SI.pdf               # Authoritative textbook reference source
├── package.json                         # Dependencies (React 19, Tailwind v4, Vite 8, oxlint)
├── src/
│   ├── main.tsx                         # React 19 entry point
│   ├── index.css                        # Tailwind v4 import & custom styles
│   ├── App.tsx                          # Core application state machine & table UI
│   ├── data/
│   │   ├── types.ts                     # Discriminated union types for all table formats
│   │   ├── tablesMeta.ts                # Metadata registry (names, substances, types, descriptions)
│   │   ├── DATA_STRUCTURES.md           # Data schema & numeric extraction rules
│   │   └── tables/                      # 17 standalone table data files (A-4 through A-25)
│   │       ├── tableA4.ts ... tableA25.ts
│   │       └── index.ts                 # Master table retrieval (`getTableData(id)`)
│   └── snippet/
│       ├── SnippetModal.tsx             # Snippet modal dialog, column toggles, hitboxes
│       └── renderSnippetCanvas.ts       # Canvas layout math, aspect ratio optimizer, rendering
```

---

## 3. Data Architecture (`src/data`)

### The `ThermoValue` Invariant: Exact Decimal Preservation
All numeric tabular values are wrapped in the `ThermoValue` interface:
```typescript
export interface ThermoValue {
  v: number;   // Parsed float used for math, interpolation, and unit conversion
  s: string;   // Canonical string with exact textbook significant figures & trailing zeros
}
```
**Agent Rule:** Never convert `ThermoValue` into a plain number in state. Plain floats drop trailing zeros (e.g. `0.001000` becomes `0.001`), violating textbook significant figures.

### Table Categories (`ThermoTableData` Discriminated Union)
Tables belong to one of four topologies defined in [`src/data/types.ts`](file:///home/sungc/Documents/antigravity/fearless-hypatia/src/data/types.ts):

| Topology | Key Tables | Structure | Key Invariant |
| :--- | :--- | :--- | :--- |
| `saturated` | A-4, A-5 (Water), A-8 (Ice), A-11, A-12 (R-134a) | Array of `SaturatedRow` with `T`, `P`, and property triplets (`vf`, `vg`, `uf`, etc.) | Indexed by `indexProperty` (`'T'` or `'P'`). Ice table (A-8) uses sublimation properties (`vi`, `hi`, `si`). |
| `superheated` / `compressed` | A-6, A-7 (Water), A-13 (R-134a) | Array of `SuperheatedBlock` (each isobar has `P`, `Tsat`, and rows with `T`, `v`, `u`, `h`, `s`) | First row in isobar represents saturation state with `isSaturationState: true` and `T` = Sat. |
| `ideal_gas_air` | A-17 (Air) | Array of `IdealGasAirRow` (`T`, `h`, `u`, `s_deg`, `s_plus`) | Indexed monotonically by `T` (Kelvin). |
| `ideal_gas_molar` | A-18 through A-25 (N2, O2, CO2, CO, H2, H2O, O, OH) | Array of `IdealGasMolarRow` (`T`, `h_bar`, `u_bar`, `s_bar_deg`) | Extensive properties are molar ($\text{kJ/kmol}$). |

---

## 4. State Architecture (`src/App.tsx`)

### Per-Table Scoping Model
Users switch between tables frequently. Selection state must never leak across different tables. Therefore, selection states are stored as dictionaries keyed by `tableId`:

```typescript
// Per-table state dictionaries
const [tablePinnedRows, setTablePinnedRows] = useState<Record<string, Set<string>>>({});
const [tablePinnedTemps, setTablePinnedTemps] = useState<Record<string, Set<string>>>({});
const [tableSelectedCols, setTableSelectedCols] = useState<Record<string, Set<string>>>({});
const [tablePinnedBlocks, setTablePinnedBlocks] = useState<Record<string, Set<number>>>({});
const [tableTouchedBlocks, setTableTouchedBlocks] = useState<Record<string, Set<number>>>({});
const [tableCollapsedBlocks, setTableCollapsedBlocks] = useState<Record<string, Set<number>>>({});
const [tableDisabledBlocks, setTableDisabledBlocks] = useState<Record<string, Set<number>>>({});

// Derived active selections for the current table
const pinnedRows = useMemo(() => tablePinnedRows[currentTableId] || new Set<string>(), [tablePinnedRows, currentTableId]);
const pinnedTemps = useMemo(() => tablePinnedTemps[currentTableId] || new Set<string>(), [tablePinnedTemps, currentTableId]);
const selectedCols = useMemo(() => tableSelectedCols[currentTableId] || new Set<string>(), [tableSelectedCols, currentTableId]);
const pinnedBlocks = useMemo(() => tablePinnedBlocks[currentTableId] || new Set<number>(), [tablePinnedBlocks, currentTableId]);
const disabledBlocks = useMemo(() => tableDisabledBlocks[currentTableId] || new Set<number>(), [tableDisabledBlocks, currentTableId]);
```

**Agent Rule:** Never create un-scoped selection states for table data. For example, `pinnedTemps` must always be scoped per table; otherwise, pinning `200 °C` in Superheated Water (A-6) will incorrectly pin row 200 in Superheated R-134a (A-13).

### Unload & Navigation Guards
`hasActiveSelections` checks if any table has active highlights or pins:
```typescript
const hasActiveSelections = useMemo(() => {
  for (const s of Object.values(tableSelectedCols)) if (s && s.size > 0) return true;
  for (const s of Object.values(tablePinnedTemps)) if (s && s.size > 0) return true;
  for (const s of Object.values(tablePinnedRows)) if (s && s.size > 0) return true;
  for (const s of Object.values(tablePinnedBlocks)) if (s && s.size > 0) return true;
  return false;
}, [tableSelectedCols, tablePinnedTemps, tablePinnedRows, tablePinnedBlocks]);
```
When `hasActiveSelections === true`, `beforeunload` prompts the user before accidentally closing or reloading the page and losing their work.

### Global Keyboard Navigation
- **<kbd>Tab</kbd>**: Opens the quick Table Switcher popup (unless focus is in an input or `isSnippetOpen === true`).
- **<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd>**: Automatically focuses the Jump Bar input.
- **<kbd>Escape</kbd>**: Closes open menus, modals, or snippet dialogs.
- **<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>C</kbd>** (inside Snippet Modal): Automatically copies the generated snippet PNG image to the system clipboard.

---

## 5. Responsive Layout & Isobar Grid Architecture

### Dual-Section Superheated Layout
Superheated tables contain two main sections:
1. **Pinned Isobars** (Top): Shows isobars the user explicitly pinned for side-by-side comparison.
2. **All Isobars** (Bottom): Shows the complete sequence of isobars in ascending pressure order.

### Strict Grid Parity
Both sections share the exact same CSS grid layout:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
```
And cards within both sections use:
```tsx
className="bg-white dark:bg-gray-900 border rounded shadow-sm flex flex-col overflow-hidden transition-all duration-300 min-w-0 w-full"
```

**Why this matters:**
- On mobile (`< 768px`), cards take `100%` width (`grid-cols-1`).
- On tablets and split-screen desktop (`>= 768px`), cards take `50%` width (`md:grid-cols-2`). With container widths of ~1000px+, each card receives ~480–500px, which fits all 6 columns (`Temp`, `v`, `u`, `h`, `s`) without horizontal scrollbars.
- On large displays (`>= 1280px`), cards take `33.3%` width (`xl:grid-cols-3`).
- Hardcoded card widths (e.g. `w-[380px]`) must never be used on isobar cards.

---

## 6. Snippet Generator Subsystem (`src/snippet`)

The Snippet Generator produces textbook-quality image clips of highlighted data for homework assignments, engineering reports, and lab documents.

```
src/snippet/
├── SnippetModal.tsx           # UI modal: column toggles, isobar selectors, action bar
└── renderSnippetCanvas.ts     # Pure canvas renderer: typography, layout, aspect-ratio optimizer
```

### Canvas Layout & Square Auto-Packing
To prevent snippets from becoming excessively tall and narrow when multiple isobars or row groups are selected, `renderSnippetCanvas.ts` calculates the optimal aspect ratio:
$$\text{Score}(c) = \left|\ln\left(\frac{W_c}{H_c}\right)\right|$$
It iterates through candidate column counts ($c \in [1..4]$) and partitions isobar blocks to minimize the score, producing a balanced, roughly 1:1 square image.

### Zero Outer Padding Invariant
The snippet canvas is tightly cropped to the exact content dimensions:
- Top: 36px red textbook header banner (`TABLE A–6: Superheated water`).
- Left/Right: 0px outer margin (borders align directly to the image edge).
- Bottom: 2px minimal safety buffer for font descenders.

### Dark Mode Immunity
Snippets are rendered using a hardcoded, light textbook palette:
- Header: `#c13726` (classic red-brick engineering textbook header).
- Background: `#ffffff` / alternate zebra rows `#f9fafb`.
- Text: `#1f2937` (gray-800) / `#111827` (gray-900).
- Circles: `#dc2626` (vibrant red emphasis circles).
Snippets generated while the user is in Dark Mode remain crisp, high-contrast, black-and-white/red textbook images ready for printing or light-themed documents.

### Memory & Object URL Lifecycle
Canvas output is strictly single-encoded via `canvas.toBlob('image/png')`:
- No `canvas.toDataURL()` synchronous base64 serialization.
- Object URLs are created with `URL.createObjectURL(blob)`.
- Active Object URLs are stored in `urlRef` and cleaned up with `URL.revokeObjectURL`:
  1. Whenever a new render replaces the existing preview.
  2. Whenever the modal unmounts or closes.

### Dialog Mounting Architecture (Race Condition Prevention)
`SnippetModal` mounts a child `SnippetModalDialog` only when `props.isOpen === true`:
```tsx
export function SnippetModal(props: SnippetModalProps) {
  if (!props.isOpen) return null;
  return <SnippetModalDialog {...props} />;
}
```
Inside `SnippetModalDialog`:
- Active columns (`activeColIds`), active blocks (`activeBlockIdxs`), and emphasized intersection cells (`emphasizedCells`) are initialized synchronously and atomically via `useState(() => compute...)`.
- This ensures that on the very first render frame, canvas rendering receives all populated rows and columns with zero frame lag or missing circled cells.

---

## 7. Tooling & Verification Commands

TabTab enforces zero-warning TypeScript compilation and ultra-fast linting:

| Command | Tool | Purpose |
| :--- | :--- | :--- |
| `npm run lint` | `oxlint` | High-speed Rust linter checking 116 rules across all 26 files. |
| `npm run build` | `tsc -b && vite build` | Strict TypeScript type checking followed by Vite production bundling. |
| `npm run dev` | `vite` | Starts local HMR development server. |
| `npm run preview` | `vite preview` | Serves the production `dist` directory locally. |

---

## 8. Checklist for Future Modifications

When making changes to TabTab:
- [ ] **Preserve `ThermoValue` shape**: Never replace `{ v: number, s: string }` with raw numbers.
- [ ] **Scope state per table**: Any new selection or display toggle must be stored under `Record<string, ...>` keyed by `currentTableId`.
- [ ] **Respect the <kbd>Tab</kbd> shortcut**: The table switcher shortcut is central to the app's identity. Never intercept <kbd>Tab</kbd> without checking `if (isSnippetOpen) return;`.
- [ ] **Maintain isobar grid parity**: Pinned Isobars and All Isobars must always share the same responsive breakpoints (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`).
- [ ] **Keep snippet canvas tightly cropped**: Do not add artificial outer padding around the canvas.
- [ ] **Verify zero errors**: Run `npm run lint` and `npm run build` before pushing any commit.
