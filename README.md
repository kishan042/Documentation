# Component Detachment Tracker

Figma plugin that scans an entire file to surface how many live component instances are in use, grouped by page and component. Results appear in an accordion-based UI with quick navigation controls.

## Features

- Summaries of total instances and unique components across the file
- Accordion UI grouped by page and component with per-instance navigation
- One-click targeting to jump to the selected node on canvas
- Rescan button for iterative document reviews

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/kishan042/Documentation-Plugin.git
   cd Documentation-Plugin
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build or watch**

   ```bash
   npm run build   # Compile once
   npm run watch   # Rebuild on file changes
   ```

4. **Load in Figma**

   - Open Figma Desktop
   - Go to `Plugins → Development → Import plugin from manifest…`
   - Select the `manifest.json` file in this repository

## Development Notes

- Output files emit to `dist/` via TypeScript
- Main plugin logic lives in `src/code.ts`
- UI is authored in `src/ui.html`
- Requires a Figma desktop environment to run

## Roadmap

- Export scan results to CSV
- Filtering and search within instance results
- Thumbnail previews for faster identification
- Batch health checks for missing main components

## License

MIT © Kishan

