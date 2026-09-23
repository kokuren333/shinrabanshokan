# Prompt and result protocol

The request ZIP embeds the Draft 2020-12 result schema. The model must finish the reading and report first, validate the complete result JSON, and only then create image content. All system collections, including `calculations`, are arrays. The result ZIP contains `result.json`, a substantial `report.md`, `manifest.json`, and one AI-generated finished card at `assets/share.png`.

The single share card is 1200×675 (16:9). The model derives `assets.shareCardCopy` (title, description, 2–3 themes) from the validated reading, removes names, birth data, locations, gender, contact details, and identifying profile facts, then uses the image-generation tool exactly once. It must render the Japanese copy verbatim inside the card; the app does not overlay text. The reading report cover is a fixed CSS design in portrait 2:3 and is not generated.

For backward compatibility, the app still imports older result ZIPs that contain `assets/summary.png`.
