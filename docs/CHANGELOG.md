# CHANGELOG

## v0.1.0 - Unreleased
- Initial MVP scaffold for AI Mermaid Live Editor
- Live Mermaid render + diff-based patch apply
- Commit timeline, share links, SVG/PNG export
- UX polish: shortcuts dialog (`?`), copy-link feedback, safer clipboard fallback
- Reliability: diff preview stays synced with editor updates
- Reliability: draft autosave with restore/clear actions
- UX: copy/download Mermaid source
- UX: PNG export controls for scale + transparency
- Reliability: large diagram guardrails (manual render, diff skip)
- UX: SVG export controls for scale + inline styles
- UX: export sizing presets with custom width
- UX: SVG minify option
- UX: copy SVG action
- UX: export summary with estimated sizes
- UX: copy PNG action + compact export panel
- UX: export presets and recent export history
- Reliability: patch proposals are validated before apply, with Mermaid line-aware error feedback
- Reliability: sanitize malformed tab localStorage payloads during startup
- CI: fixed strict typecheck regressions in `src/main.js` and added helper unit tests
- CI: workflow now uses `npm ci` with npm cache for deterministic installs
- UX: import Mermaid from URL (remote file or share link) into a new tab
- AI: generation controls (temperature/max tokens/timeout) + cancel
- DX: optional Playwright browser smoke check (`make smoke`)
