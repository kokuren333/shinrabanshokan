# 森羅万象鑑

**あらゆる占術から、ひとりを読む。** A static, local-first frontend for carrying a structured divination request to an AI and bringing the validated reading back as a readable report.

## Why static

There is no required server, database, API key, or direct AI connection. Form data and imported readings stay in this browser. The request/result formats are JSON and ZIP so they remain readable and portable across tools.

## Use

1. Open the app and choose **鑑定をはじめる**. Enter a name and birth date, choose questions and systems, then download the request ZIP or copy its prompt.
2. Give the ZIP to ChatGPT or another model and ask it to follow `instructions.md` and `prompt.md`. Request a result ZIP containing `result.json`, `report.md`, and `manifest.json`.
3. Choose **結果を読む** and load the result ZIP or result JSON. The app validates it and renders a report.
4. Save a print-ready A4 PDF, create a share card PNG, or open an X share intent.

The included catalog describes origin, era, required inputs, birth-time needs, and historical status. Dreamspell is explicitly separated from historical Maya calendars. Divination is presented as cultural and symbolic interpretation, not scientific, medical, or certain prediction.

## Development

```sh
npm install
npm run dev
npm run lint
npm test
npm run build
```

## GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` builds and deploys the static `dist` directory. It uses the repository name as Vite's base path in GitHub Actions. Enable GitHub Pages with **GitHub Actions** as the build source in repository settings.

## Protocol and design notes

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/FORMAT.md](docs/FORMAT.md), and [docs/PROMPT_PROTOCOL.md](docs/PROMPT_PROTOCOL.md). Browser localStorage can be cleared by the user from the app's record page or browser settings.
