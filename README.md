# TabTab: Thermodynamic Property Tables

TabTab is a modern, interactive web application that brings standard thermodynamic property tables into the digital age. Built with React and Tailwind CSS, it offers a fast, user-friendly interface for engineers, researchers, and students to quickly find and analyze thermodynamic properties.

## Features

- **Interactive Property Tables:** View properties for Saturated, Superheated, Compressed, and Ideal Gas states.
- **Smart Jump-To Search:** Instantly scroll to the nearest temperature or pressure value with visual highlighting.
- **Row & Column Pinning:** Pin specific rows (like an isotherm) and columns to compare data easily as you scroll.
- **Synchronized Highlighting:** Pinned rows intelligently synchronize across pressure blocks in superheated tables.
- **Unit Toggling:** Seamlessly switch between Celsius and Kelvin (for temperature) and MPa and kPa (for pressure).
- **Responsive Layout:** Adaptive grid view for superheated tables, optimizing horizontal and vertical space.

## Technology Stack

- **Framework:** React 19 (via Vite)
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Data:** Statically typed TypeScript data models (src/data)
- **Deployment Ready:** Configured for seamless deployment on static hosting platforms.

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or pnpm

### Installation

1. Clone the repository or download the source code.
2. Navigate to the project directory:
   \cd thermo-table\
3. Install dependencies:
   \
pm install\
4. Start the development server:
   \
pm run dev\

### Building for Production

To build the application for production, run:

\
pm run build\

This will generate a dist folder containing optimized, static assets ready for deployment. See [DEPLOYMENT.md](DEPLOYMENT.md) for more details.

## State Management Architecture

TabTab uses a pure client-side React architecture:
- Data is strictly typed and stored statically in src/data/tables.
- The main interface state (App.tsx) uses useState and useRef to manage active tables, highlighted cells, jump navigation, and scrolling.
- Per-table state persistence allows users to switch between different tables without losing their pinned rows or columns.

## License

This project is intended for educational and engineering reference.
