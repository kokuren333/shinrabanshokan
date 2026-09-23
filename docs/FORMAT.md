# Package format 1.0.0

## Request ZIP

`shinra-bansho-request-YYYY-MM-DD.zip` contains `request.json`, `schema/request.schema.json`, `instructions.md`, `prompt.md`, `manifest.json`, and `README.md`. Manifest `format` is `shinra-bansho-request`; `version` is semver `1.0.0`. The request stores the subject, precision-aware birth time, questions, selected system IDs, and interpretation options. Optional identity and location fields may be omitted. Unknown fields are preserved by consumers for forward compatibility.

## Result ZIP

`shinra-bansho-result.zip` contains `result.json`, `report.md`, `manifest.json`, and optional assets such as `assets/summary.png` and `assets/share.png`. Manifest `format` is `shinra-bansho-result`; `version` starts with `1.`. Missing images are valid. The result envelope has `schemaVersion`, `subject`, `meta`, `baseInfo`, `systems`, `crossAnalysis`, `domainProfiles`, `summary`, `limitations`, and `assets`. Each system uses a common `id`, optional `name` and `status`, `inputsUsed`, `calculations`, `facts`, `interpretation`, `uncertainties`, and `sources` shape. Cross analysis separates strong/moderate themes, contradictions, and dependency warnings.

The reader also accepts a standalone `result.json`. Request ZIPs are detected and rejected with a Japanese explanation when supplied as a result. Malformed JSON, a missing result file, wrong format, unsupported major version, and schema failures are reported before rendering.
