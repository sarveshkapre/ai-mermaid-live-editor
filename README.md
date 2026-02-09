# AI Mermaid Live Editor

Split-screen Mermaid editor with live preview and patch-driven AI refactors.

## Why this exists
- Iterate on Mermaid diagrams faster with a side-by-side renderer.
- Apply AI-generated changes as patches with a diff preview.
- Keep a lightweight commit timeline with quick rollbacks.

## Features
- Live Mermaid rendering with error surfacing
- Patch preview with line diff
- Commit history with restore
- Auto restore point saved before patch apply
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
- Export presets per diagram + recent export history
- Export history JSON download
- Dark mode and keyboard shortcuts
- Patch validation before apply (line-aware Mermaid errors)
- Tab persistence recovery for malformed local state

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
