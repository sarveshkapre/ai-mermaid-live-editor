# AI Mermaid Live Editor

Local-first split-screen Mermaid editor with live rendering, patch-driven refactors, share links, and exports.

## Features
- Live Mermaid rendering with error surfacing
- Patch proposal + diff preview + apply
- Snapshot timeline (localStorage) with restore + diff
- Shareable links via URL hash
- SVG/PNG export
- Dark mode + keyboard shortcuts

## Shipped (2026-02-01)
- Shortcuts dialog (`?` to open) + accessible dialog styling
- Share-link copy feedback + safer clipboard fallback + URL hash sync via `replaceState`
- Diff preview stays in sync with editor changes
- Local draft autosave + restore/clear actions (prevents accidental refresh data loss)
- Copy/download Mermaid source buttons
- PNG export controls (scale + transparent background)
- Guardrails for large diagrams (pause auto-render, skip huge diffs)
- SVG export controls (scale + inline styles option)
- Export sizing presets (auto/small/medium/large/custom width)
- Confirm prompts for destructive actions (reset, clear history)
- Added a wiring test to ensure `index.html` contains required element IDs

## Next to ship
- UX: export sizing presets
- Reliability: performance guardrails for very large diffs/diagrams
- Product: real AI provider integration (OpenAI-compatible) with patch validation

## Top risks / unknowns
- Mermaid render performance on very large diagrams
- Diff performance for large multi-line edits (current LCS is O(n*m))
- Export fidelity for complex diagrams (fonts, sizing, high-DPI PNG)

## Commands
See `docs/PROJECT.md` or run:
```bash
make setup
make dev
make check
```
