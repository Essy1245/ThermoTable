# Thermodynamic Tables Data Structures

This document outlines the data structures, typings, and conventions used to represent the 17 thermodynamic tables in the `thermo-table` project.

## Core Principle: Exact Decimal Preservation

When extracting tabular data from the PDF, it is imperative to maintain the exact significant figures and trailing zeros for UI representation, while simultaneously exposing a raw numeric value for math operations (like interpolation).
We achieve this through the `ThermoValue` interface:

```typescript
export interface ThermoValue {
  v: number;   // The parsed float for mathematical operations, plotting, and unit conversions.
  s: string;   // The exact string from the PDF (e.g., "0.001000") for display.
}
```

Whenever data is entered manually or via automated extraction, **every numeric cell must be captured as a `ThermoValue`**.

## Table Categories & Topologies

We have identified 4 distinct table topologies to represent all 17 target tables. They are grouped in a discriminated union `ThermoTableData` in `src/data/types.ts`.

### 1. Saturated Tables
- **Tables**: A-4 (Water Temp), A-5 (Water Press), A-8 (Ice-water), A-11 (R-134a Temp), A-12 (R-134a Press)
- **Structure**: Each row corresponds to a specific Temperature (T) or Pressure (P).
- **Fields**: Contains specific volume ($v$), internal energy ($u$), enthalpy ($h$), and entropy ($s$). Properties use `f` (liquid), `g` (vapor), `i` (ice) suffixes and their differences (`fg`, `ig`).
- **Invariant**: Every row must have a `T` and `P` value. Either `T` or `P` will be cleanly spaced depending on `indexProperty`. 

### 2. Superheated & Compressed Tables
- **Tables**: A-6 (Superheated Water), A-7 (Compressed Water), A-13 (Superheated R-134a)
- **Structure**: Grouped into **Isobar Blocks**. Each block has a uniform Pressure ($P$) and corresponding saturation temperature ($T_{sat}$).
- **Fields**: A block contains multiple rows indexed by Temperature ($T$). Properties include $v, u, h, s$.
- **Invariant**: The first row in each block usually represents the saturation state and its `isSaturationState` flag must be set to `true`.

### 3. Ideal Gas: Air
- **Table**: A-17
- **Structure**: Simple list of properties mapped to Temperature ($T$).
- **Fields**: Temperature ($T$), Enthalpy ($h$), Internal Energy ($u$), $s^\circ$ (`s_deg`), and optionally $p_r$, $v_r$, etc.
- **Invariant**: Temperature is exactly monotonic.

### 4. Molar Ideal Gases
- **Tables**: A-18 (N2), A-19 (O2), A-20 (CO2), A-21 (CO), A-22 (H2), A-23 (H2O), A-24 (O), A-25 (OH)
- **Structure**: Similar to the Air table, but properties are on a **molar basis** (per kmol instead of per kg).
- **Fields**: $T$, $\bar{h}$ (`h_bar`), $\bar{u}$ (`u_bar`), $\bar{s}^\circ$ (`s_bar_deg`).
- **Invariant**: All extensive properties must be molar values.

## File Naming Convention & Directory Layout

All parsed table data should be exported as individual `.ts` files inside `src/data/tables/`. A single index file should aggregate and export them.

```
src/data/
  ├── types.ts                  # Central TS definitions (ThermoValue, Table Interfaces)
  ├── DATA_STRUCTURES.md        # This documentation file
  └── tables/
      ├── tableA4.ts            # Saturated Water (Temperature)
      ├── tableA5.ts            # Saturated Water (Pressure)
      ├── tableA6.ts            # Superheated Water
      ├── ...
      ├── index.ts              # Exports all tables in a single ThermoData or array object
```

Each table file should export a default object conforming to `ThermoTableData`:

```typescript
import { ThermoTableData } from '../types';

const tableA4: ThermoTableData = {
  type: 'saturated',
  name: 'Table A-4: Saturated water—Temperature table',
  substance: 'Water',
  indexProperty: 'T',
  rows: [
    {
      T: { v: 0.01, s: '0.01' },
      P: { v: 0.6117, s: '0.6117' },
      vf: { v: 0.001000, s: '0.001000' },
      // ...
    },
    // ...
  ]
};

export default tableA4;
```

## Workflows for Downstream Agents
1. **Extraction**: When reading from PDF text or CSVs, parse numeric strings directly into the `ThermoValue` shape: `{ v: parseFloat(str), s: str.trim() }`.
2. **Validation**: Check for NaNs. If a cell is blank in the PDF, omit it from the object or set it to `undefined` (do not set `v: 0`).
3. **Compilation**: Import all individual `.ts` tables into `src/data/tables/index.ts` and export a master `tables` array for the application UI and math engines.
