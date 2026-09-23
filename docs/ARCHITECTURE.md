# Architecture

森羅万象鑑 is a static React + TypeScript + Vite single-page application. It has no server, API key, or analytics integration. Form state and the latest imported report are kept in localStorage; imports, validation, ZIP operations, report rendering, and share-card drawing happen in the browser.

The `src/protocol.ts` module is the protocol boundary. Zod schemas validate request and result JSON, `createRequestZip` writes the portable request package, and `parseResultBundle` handles result ZIP/JSON input. UI rendering is kept in `src/main.tsx`. The report uses semantic sections and print-specific A4 CSS. GitHub Pages base paths are selected from `GITHUB_REPOSITORY` in CI.

Version 1 uses an additive JSON approach: readers tolerate unknown fields, while required envelope fields and the common system shape are checked. `mode` already includes `individual` and `compatibility`; multiple subjects and additional divination modalities can be added without changing the package envelope.
