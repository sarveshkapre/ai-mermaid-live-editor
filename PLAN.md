# AI Mermaid Live Editor

Local-first split-screen Mermaid editor with live rendering, patch-driven refactors, share links, and exports.

## Features
- Live Mermaid rendering with error surfacing
- Patch proposal + diff preview + apply
- Snapshot timeline (localStorage) with restore + diff
- Shareable links via URL hash
- SVG/PNG export
- Dark mode + keyboard shortcuts
- Mermaid lint assistant with safe quick-fix staging into patch proposal

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
- SVG export minify option
- Copy SVG action
- Export summary with estimated output sizes
- Copy PNG action + compact export panel
- Export presets + recent export history
- Confirm prompts for destructive actions (reset, clear history)
- Added a wiring test to ensure `index.html` contains required element IDs

## Shipped (2026-02-08)
- Patch proposals are validated before apply; invalid Mermaid is blocked with line-aware feedback.
- Tab state loading now sanitizes malformed localStorage data instead of trusting raw payloads.
- CI stability fixed for strict JS type-checking in `src/main.js` (no implicit `any` regressions).
- Added unit coverage for tab normalization and Mermaid error parsing helpers.

## Next to ship
- UX: personal template library (save/import/export)
- Reliability: diff scalability fallback for large edits
- Product: multi-diagram organization (tags + search)

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
