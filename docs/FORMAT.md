# Package format 1.0.0

## Request ZIP

`shinra-bansho-request-YYYY-MM-DD.zip` contains `request.json`, `schema/request.schema.json`, `schema/result.schema.json`, `instructions.md`, `prompt.md`, `manifest.json`, and `README.md`. Manifest `format` is `shinra-bansho-request`; `version` is semver `1.0.0`. The request stores the subject, precision-aware birth time, questions, selected system IDs, and interpretation options. Optional identity and location fields may be omitted. Unknown fields are preserved by consumers for forward compatibility.

## Result ZIP

The required core of a `shinra-bansho-result.zip` is `result.json`, `report.md`, and `manifest.json`. `assets/share.png` or another supported raster card is optional. Image generation is best-effort, so missing images and dimensions other than 1200×675 do not invalidate the result. When present, `assets.shareImage` points to the actual file. `assets.shareCardCopy` may contain private-data-free Japanese title, description, themes, and fact-linked motifs. `assets.shareGeneration` is optional and must truthfully describe the actual generation status, provider/model/tool, and known output dimensions.

Manifest `format` is `shinra-bansho-result`; `version` starts with `1.`. The result envelope has `schemaVersion`, `subject`, `meta`, `baseInfo`, `systems`, `crossAnalysis`, `domainProfiles`, `summary`, `limitations`, and `assets`. Each system uses arrays for `inputsUsed`, `calculations`, `facts`, `interpretation`, `uncertainties`, and `sources`. A one-off value still belongs in a one-item array; unused fields use `[]`.

If a service cannot return ZIP attachments, it can return a standalone `result.json` containing the complete report in `reportMarkdown`. The reader accepts that JSON, archives with a root folder, and common object-shaped list fields (including legacy object-shaped calculations); repairs are recorded as import notices. It discovers common share-card filenames and supported PNG/JPEG/WebP/GIF image signatures. Request ZIPs are detected and rejected with a Japanese explanation when supplied as a result. Malformed JSON, missing result files, wrong format, unsupported major versions, and remaining unrepairable schema failures are reported before rendering.

The copy-prompt flow returns prose and an optional generated card directly in ChatGPT. It does not ask for result JSON or ZIP.
