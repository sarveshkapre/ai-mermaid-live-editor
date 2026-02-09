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
- OpenAI-compatible patch generation (optional; bring your own provider/proxy)
- AI generation controls (temperature/max tokens/timeout) + cancel
- Shareable links (URL hash)
- Share links that import into a new tab (copy link with `?tab=new`)
- SVG/PNG export
- PDF export (print / save as PDF)
- Preview zoom with space-drag pan
- Import Mermaid files into tabs
- Import Mermaid from URL (remote file or share link) into a new tab
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
- Format Mermaid (safe whitespace normalization) with non-destructive preview

## Quickstart
```bash
make setup
make dev
```
Open `http://localhost:5173`.

## Browser Smoke Check (Optional)
```bash
make smoke
```
If you have not installed browsers yet, run `npx playwright install chromium` once.

## AI Patch Generation (Optional)
This app can generate patch proposals using an OpenAI-compatible API. For security and CORS, the recommended setup is to run a local proxy and keep the API key in your shell environment (not in the browser).

1. Start the proxy:
```bash
OPENAI_API_KEY=... node scripts/ai-proxy.mjs
```

2. In the app (AI patch studio -> AI provider settings):
- Set `API base URL` to `http://127.0.0.1:8787/v1`
- Choose `API mode` (Chat Completions or Responses)
- Set `Model` (default: `gpt-4.1`)
- Leave `API key` blank (the proxy supplies it)

If you point the app directly at a provider API, do not enable “Remember API key” unless you accept the localStorage risk for that device.

## Shortcuts
- `Ctrl/Cmd + Enter`: apply patch
- `Ctrl/Cmd + S`: commit snapshot
- `?`: open shortcuts dialog

## License
MIT
