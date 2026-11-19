# TabTab: Thermodynamic Property Tables

TabTab is a modern, high-speed, interactive web application that brings standard engineering thermodynamic property tables into the digital age. Built with React 19, Vite, and Tailwind CSS v4, it offers an instant, keyboard-first interface for engineers, researchers, and students to find, analyze, and export thermodynamic data.

---

## Features

- **17 Interactive Property Tables**: Comprehensive SI property tables covering:
  - **Molar Mass, Gas Constants and Critical Properties**: Table A-1
  - **Ideal-Gas Specific Heats**: Tables A-2(a), A-2(b), and A-2(c)
  - **Liquids, Solids, and Foods**: Tables A-3(a), A-3(b), and A-3(c)
  - **Saturated Water**: Table A-4 (Temperature) & Table A-5 (Pressure)
  - **Superheated Water Vapor**: Table A-6
  - **Compressed Liquid Water**: Table A-7
  - **Saturated Refrigerant-134a**: Table A-11 (Temperature) & Table A-12 (Pressure)
  - **Superheated Refrigerant-134a**: Table A-13
  - **Ideal Gas Properties of Air**: Table A-17
  - **Molar Ideal Gases**: Table A-18 ($\text{N}_2$) and A-19 ($\text{O}_2$)
- **Smart Jump-To Search (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd>)**: Find the nearest selected property value or a substance, with visual highlighting and automatic scrolling. Multi-isobar tables use pressure to find a block.
- **Property Visibility**: Show or hide individual properties on superheated, compressed, and ideal-gas tables; choices are remembered per table.
- **Fast Table Switcher (<kbd>Tab</kbd>)**: Quick search menu with fuzzy table lookup, substance badges, and state filters.
- **Copy-Pasteable Snippet Generator**: Export publication-grade textbook image snippets with dark-mode immunity, 1:1 square auto-packing, and interactive cell emphasis circles.
- **Row, Column, & Block Pinning**: Pin isotherms, specific property columns, or entire isobars to compare data side-by-side.
- **Per-Table State Scoping**: Selections, pinned rows, and active columns remain safely isolated per table without leaking when switching.
- **Dual Isobar Responsive Grid**: Pinned and unpinned isobar cards share identical responsive breakpoints (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`), maximizing screen space and eliminating column cutoff.
- **Seamless Unit Conversion**: Toggle between Celsius (°C) and Kelvin (K), as well as $\text{MPa}$, $\text{kPa}$, and $\text{bar}$.

---

## Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Tab</kbd> | Open Table Switcher modal | Global (table view) |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Focus Jump-To input | Global |
| <kbd>Escape</kbd> | Close active modal, dropdown, or search | Global |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>C</kbd> | Copy generated snippet image to clipboard | Snippet Modal |

---

## Technology Stack

- **Framework**: React 19 via Vite 8
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Linter**: `oxlint` (Rust-based ultra-fast linter)
- **Type Checker**: TypeScript 6.0 (`strict: true`)
- **Graphics**: HTML5 2D Canvas (Textbook layout engine)

---

## Getting Started

### Prerequisites
- Node.js 22.12 or newer (the test command requires Node.js 22's TypeScript stripping support)
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Essy1245/ThermoTable.git
   cd ThermoTable
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.

### Production Build & Verification

```bash
# Run linter
npm run lint

# Run focused regression tests
npm test

# Build optimized production assets
npm run build

# Preview production build locally
npm run preview
```

---

## Documentation for Developers & Agents

Detailed architectural guides, data contracts, and development rules are available in the repository:
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: System design, per-table state model, canvas snippet generator, responsive grid engine, and invariants for downstream AI agents.
- **[DATA_STRUCTURES.md](src/data/DATA_STRUCTURES.md)**: Exact decimal preservation (`ThermoValue`), table categories, and raw PDF data extraction schemas.
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Instructions for hosting on GitHub Pages, Vercel, Netlify, and custom domains.

---

## AI Transparency
This application was architected, implemented, and refined collaboratively with autonomous AI engineering agents.
