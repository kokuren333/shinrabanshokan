# Prompt protocol

The generated prompt combines core instructions, the subject record, selected questions and system names, and the output contract. It asks the model to distinguish historical traditions from modern esoteric systems, avoid filling missing birth data with guesses, state lineage and uncertainty, show calculations and sources, and discount correlated systems rather than treating them as independent votes.

The ZIP result contract asks for `result.json`, `report.md`, and a `manifest.json`; summary/share PNG files are optional and must be declared in the manifest when omitted. Result JSON has a shared envelope and a consistent structure for each system, so the browser can validate and display the reading without relying on generated prose parsing.

Simple copy mode uses the same prompt content, ending with the request to return the reading directly in Markdown without a ZIP.
