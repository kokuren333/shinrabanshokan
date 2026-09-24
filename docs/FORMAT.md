# Package format 1.0.0

## Request ZIP

`shinra-bansho-request-YYYY-MM-DD.zip` contains `request.json`, `schema/request.schema.json`, `schema/result.schema.json`, `instructions.md`, `prompt.md`, `manifest.json`, and `README.md`. Manifest `format` is `shinra-bansho-request`; `version` is semver `1.0.0`. The request stores the subject, precision-aware birth time, questions, selected system IDs, and interpretation options. Optional identity and location fields may be omitted.

## Result ZIP

The required core of a `shinra-bansho-result.zip` is `result.json`, `report.md`, and `manifest.json`. When the active AI environment can generate images, it must generate one detailed individualized card after completing and validating the reading, then include that raster image in the ZIP. If no generation feature/access/quota is available or the generation call fails, the ZIP remains valid without an image. Preferred image dimensions are 1200×675 (16:9); any actual output dimensions are accepted as-is.

When present, `assets.shareImage` points to the actual image file. `assets.shareCardCopy` supports anonymous `title`, `description`, `themes`, structured `sections`, and fact-linked `visualMotifs`. `assets.shareGeneration` truthfully records the actual generation status, provider/model/tool, and known output dimensions. The infographic should use the supplied design references as guidance: indigo and gold cosmic/archival styling, parchment panels, a central symbolic scene, and readable panels for the result's overall conclusion, personality, strengths, cautions, advice, answers, and calculated evidence. Include only material supported by the actual reading; invented numbers, scores, dates, chart values, or predictions are forbidden. Personal identifying data (name, date/time/place of birth, age, gender, location, contact details) must never appear in the card, card copy, or generation metadata.

Manifest `format` is `shinra-bansho-result`; `version` starts with `1.`. The result envelope has `schemaVersion`, `subject`, `meta`, `baseInfo`, `systems`, `crossAnalysis`, `domainProfiles`, `summary`, `limitations`, and `assets`. Each system uses arrays for `inputsUsed`, `calculations`, `facts`, `interpretation`, `uncertainties`, and `sources`. A one-off value still belongs in a one-item array; unused fields use `[]`.

If a service cannot return ZIP attachments, it can return a standalone `result.json` containing the complete report in `reportMarkdown`. The reader accepts that JSON, archives with a root folder, and common object-shaped list fields (including legacy object-shaped calculations); repairs are recorded as import notices. It discovers common share-card filenames and supported PNG/JPEG/WebP/GIF image signatures. Request ZIPs are detected and rejected with a Japanese explanation when supplied as a result. Malformed JSON, missing result files, wrong format, unsupported major versions, and remaining unrepairable schema failures are reported before rendering.

The copy-prompt flow returns prose and, when image generation is available, the same mandatory detailed card directly in ChatGPT. It does not ask for result JSON or ZIP.
