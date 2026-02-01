# AI Mermaid Live Editor

Split-screen Mermaid editor with live rendering plus a patch-driven AI panel for refactors. Local-first, shareable links, and exportable SVG/PNG.

## Why this exists
- Iterate on Mermaid diagrams faster with a side-by-side renderer.
- Apply AI-generated changes as patches with a diff preview.
- Keep a lightweight commit timeline with quick rollbacks.

## Features
- Live Mermaid rendering with error surfacing
- Patch preview with line diff
- Commit history with restore
- Shareable links (URL hash)
- SVG/PNG export
- Draft autosave with restore/clear
- Copy/download Mermaid source
- PNG export controls (scale, transparency)
- Large diagram guardrails (manual render, diff skip)
- SVG export controls (scale, inline styles)
- Export width presets (auto/small/medium/large/custom)
- SVG minify option
- Copy SVG action
- Copy PNG action
- Export summary with estimated output sizes
- Dark mode and keyboard shortcuts

## Quickstart
```bash
make setup
make dev
```
Open `http://localhost:5173`.

## Shortcuts
- `Ctrl/Cmd + Enter`: apply patch
- `Ctrl/Cmd + S`: commit snapshot
- `?`: open shortcuts dialog

## License
MIT
