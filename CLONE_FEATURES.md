# Clone Feature Tracker

## Context Sources
- README and docs (`PLAN.md`, `docs/ROADMAP.md`, `docs/PROJECT.md`)
- GitHub Actions failures: runs `21702497753` and `21579298912`
- Local baseline check (`make check`)
- Quick code review sweep in `src/main.js` and `src/lib/*`

## Candidate Features To Do
- [ ] P3: AI streaming output (progressively fill proposal) for OpenAI-compatible SSE.
- [ ] P3: Surface AI token/usage metadata when providers return it (Responses/Chat Completions).
- [ ] P3: Diagram linting helpers (detect common Mermaid mistakes + quick fixes).
- [ ] P3: User template gallery (save personal templates + import/export).
- [ ] P3: Diff performance: consider Myers/patience diff fallback for large edits (keep current limits).
- [ ] P3: Multi-diagram workspace: tags + search across tabs/history.

## Cycle 5 Prioritization (2026-02-09)
Scoring: 1 (low) to 5 (high). Risk: 1 (low) to 5 (high).

| Task (selected) | Impact | Effort | Strategic fit | Differentiation | Risk | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| Presentation mode (snapshot step-through) | 4 | 3 | 5 | 2 | 2 | 4 |
| Smoke coverage for presentation mode | 3 | 2 | 4 | 1 | 2 | 4 |
| Docs alignment (presentation + shortcuts) | 2 | 1 | 4 | 1 | 1 | 5 |

## Cycle 4 Prioritization (2026-02-09)
Scoring: 1 (low) to 5 (high). Risk: 1 (low) to 5 (high).

| Task (selected) | Impact | Effort | Strategic fit | Differentiation | Risk | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| PDF export (print-friendly) | 4 | 3 | 5 | 2 | 2 | 4 |
| Share-link “open in new tab” copy UX | 4 | 2 | 5 | 2 | 1 | 5 |
| Import-from-URL modal dialog | 3 | 2 | 4 | 1 | 1 | 4 |
| Format Mermaid (safe whitespace) with preview | 3 | 2 | 4 | 1 | 1 | 4 |

## Cycle 3 Prioritization (2026-02-09)
Scoring: 1 (low) to 5 (high). Risk: 1 (low) to 5 (high).

| Task (selected) | Impact | Effort | Strategic fit | Differentiation | Risk | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| Import Mermaid from URL into new tab | 4 | 2 | 5 | 2 | 2 | 4 |
| AI generation controls + cancel | 4 | 2 | 5 | 3 | 2 | 4 |
| Playwright browser smoke automation | 3 | 3 | 4 | 2 | 2 | 3 |

## Implemented
- [x] (2026-02-09) P1 presentation: added a lightweight full-screen presentation mode to step through snapshots (timeline + keyboard `P`), plus per-snapshot “Present” actions and a fullscreen toggle.
  - Evidence: `index.html`, `src/main.js`, `src/styles.css`, `tests/dom-ids.test.js`, `scripts/smoke-browser.mjs`, `README.md`, `docs/ROADMAP.md`, `CHANGELOG.md`, `make check`, `make smoke`.
  - Commit: `eb3e3e6`
- [x] (2026-02-09) P2 export: added PDF export via browser print (save as PDF) with page/margin/background settings.
  - Evidence: `index.html`, `src/main.js`, `src/styles.css`, `tests/dom-ids.test.js`, `make check`, `make smoke`.
  - Commit: `b452332`
- [x] (2026-02-09) P2 share/import UX: added “Copy link (new tab)” and an importable snapshot link; cleaned up `?tab=new` / readonly params after import.
  - Evidence: `index.html`, `src/main.js`, `README.md`, `docs/ROADMAP.md`, `make check`.
  - Commit: `b452332`
- [x] (2026-02-09) P2 import UX: replaced `prompt()`-based import-from-URL with a modal dialog (better UX + fewer browser quirks).
  - Evidence: `index.html`, `src/main.js`, `src/styles.css`, `tests/dom-ids.test.js`.
  - Commit: `b452332`
- [x] (2026-02-09) P2 format: added “Format Mermaid” (safe whitespace normalization) staged into Patch proposal for non-destructive diff preview.
  - Evidence: `index.html`, `src/main.js`, `README.md`.
  - Commit: `b452332`
- [x] (2026-02-09) P0 repo contract: tracked the root `AGENTS.md` operating contract and refreshed the prioritized feature backlog.
  - Evidence: `AGENTS.md`, `CLONE_FEATURES.md`.
  - Commit: `023de7b`
- [x] (2026-02-09) P2 import: added import-from-URL into a new diagram tab (supports remote `.mmd` fetch or app share links; size limits + Mermaid parse warning).
  - Evidence: `src/main.js`, `index.html`, `tests/dom-ids.test.js`, `make check`.
  - Commit: `9bd9917`
- [x] (2026-02-09) P2 AI: added generation controls (temperature/max tokens/timeout) + cancel for AI patch generation.
  - Evidence: `src/main.js`, `index.html`, `src/styles.css`, `tests/dom-ids.test.js`, `make check`.
  - Commit: `8c1d12a`
- [x] (2026-02-09) P2 QA: added Playwright-based browser smoke automation for render + patch apply + tab lifecycle.
  - Evidence: `scripts/smoke-browser.mjs`, `package.json`, `Makefile`, `README.md`, `make smoke`.
  - Commit: `af4e302`
- [x] (2026-02-09) P1 security: hardened Mermaid initialization with explicit `securityLevel: "strict"` and locked secure keys to prevent directive overrides.
  - Evidence: `src/lib/mermaid-loader.js`, `tests/mermaid-loader.test.js`, `make check`.
  - Commit: `c6dcede`
- [x] (2026-02-09) P1 UX parity: persisted preview zoom and added space-drag pan for large diagrams.
  - Evidence: `src/main.js`, `src/styles.css`, `index.html`, `README.md`.
  - Commit: `5c300e3`
- [x] (2026-02-09) P2 import: added import-from-file into a new diagram tab with size limits and filename-based tab titles.
  - Evidence: `src/main.js`, `index.html`, `tests/dom-ids.test.js`.
  - Commit: `b4dae83`
- [x] (2026-02-08) P0 CI unblock: fixed strict JS typecheck failures in `src/main.js` by adding explicit JSDoc typing and safe payload normalization.
  - Evidence: `src/main.js`, `npm run typecheck`, `make check`.
- [x] (2026-02-08) P1 reliability: hardened tab persistence with sanitized localStorage state and active-tab recovery.
  - Evidence: `src/lib/tabs.js`, `tests/tabs.test.js`.
- [x] (2026-02-08) P1 product safety: added Mermaid patch validation before apply, with line-aware error feedback.
  - Evidence: `src/main.js`, `src/lib/mermaid-error.js`, `tests/mermaid-error.test.js`.
- [x] (2026-02-08) P2 CI DX: switched workflow install step to deterministic `npm ci` and enabled npm cache.
  - Evidence: `.github/workflows/ci.yml`.
- [x] (2026-02-08) P2 memory/docs alignment: updated roadmap/changelog/plan/readme to reflect shipped behavior.
  - Evidence: `README.md`, `PLAN.md`, `CHANGELOG.md`, `docs/CHANGELOG.md`, `docs/ROADMAP.md`.
- [x] (2026-02-09) P0 perf: lazy-loaded Mermaid to shrink initial bundle and prevent stale async renders.
  - Evidence: `src/lib/mermaid-loader.js`, `src/main.js`, `npm run build`.
- [x] (2026-02-09) P1 UX: added export-history JSON download (separate from snapshot history export).
  - Evidence: `index.html`, `src/main.js`, `tests/dom-ids.test.js`.
- [x] (2026-02-09) P1 safety: auto-saved a restore point snapshot before applying patches.
  - Evidence: `src/main.js`, `npm run test`.
- [x] (2026-02-09) P2 perf: sped up line diff by trimming common prefix/suffix before DP.
  - Evidence: `src/lib/diff.js`, `tests/diff.test.js`.
- [x] (2026-02-09) P1 AI: added OpenAI-compatible patch generation (provider settings, safe parsing, Mermaid extraction) plus one-click “Undo patch”.
  - Evidence: `index.html`, `src/main.js`, `src/lib/ai-patch.js`, `tests/ai-patch.test.js`, `make check`.
  - Commit: `5502d2c`
- [x] (2026-02-09) P1 AI DX: added a local CORS-safe proxy for OpenAI APIs (API key via env, optional browser key).
  - Evidence: `scripts/ai-proxy.mjs`, `README.md`, `eslint.config.js`, `docs/ROADMAP.md`.
  - Commit: `4509885`

## Insights
- Both failing GitHub runs were rooted in strict TS checks (`checkJs`) after state-heavy features landed in `src/main.js`.
- Startup state was previously trusting raw localStorage arrays; corrupted entries could silently poison runtime state.
- Blocking invalid Mermaid proposals before apply avoids accidental overwrite of valid diagrams and improves trust in AI patch flow.
- Mermaid is now split into a separate `mermaid.core-*.js` chunk, keeping the initial `index-*.js` small for faster first paint.
- `renderMermaid()` is async; adding a monotonic render sequence prevents older renders from overwriting newer edits.
- Defaulting Mermaid to strict security mode reduces risk from pasted/share-linked diagrams; locking secure keys prevents inline init directives from weakening defaults.
- Preview UX parity: space-drag pan helps navigate large diagrams without fighting scrollbars; zoom now persists via localStorage.
- File import is safest when it creates a new tab (non-destructive) and enforces a size limit to avoid hangs.
- Import-from-URL is useful parity: it reduces friction to move diagrams between tools, repos, and chat threads.
- A dedicated browser smoke script catches DOM-wiring regressions that unit tests miss (render/pan/patch/tab flows).
- Using `?tab=new` / `?import=1` as one-shot import flags is best when the app clears them after import, keeping URLs clean and editable.
- Modal dialogs are a better UX than `prompt()` for import flows and avoid browser-specific `prompt()` behavior differences.

## Market Scan Notes (2026-02-09)
- Baseline expectations for Mermaid editors in the wild include: URL sharing, export to PNG/SVG (often PDF too), themes, autosave/recovery, and (in some products) collaboration/comments/presentations. Sources:
  - Mermaid Chart launched with shareable diagram links and a presentation mode feature, reinforcing “share + present” as a common expectation. (source: `https://docs.mermaidchart.com/blog/posts/mermaid-chart-officially-launched-with-sharable-diagram-links-and-presentation-mode`)
  - Online Mermaid Viewer markets “export SVG/PNG” and “share via URL”, plus pan + fullscreen controls as parity UX. (source: `https://mermaid-viewer.com/en`)
  - Modern Mermaid markets annotation tools plus flexible export + URL sharing, suggesting differentiation is trending toward markup/annotation layers beyond vanilla Mermaid. (source: `https://modern-mermaid.live/features.html`)
  - MarkChart (native app) lists PDF/PNG/SVG export, syntax highlighting, and templates, reinforcing multi-format export parity. (source: `https://apps.apple.com/us/app/markchart-mermaid-preview/id6475648822`)
- Mermaid security configuration supports `securityLevel` and “secure config keys” to prevent diagram directives from overriding site defaults; this matters for share links and pasted content. (source: `https://mermaid.js.org/config/schema-docs/config`, `https://mermaid.js.org/config/setup/mermaid/interfaces/MermaidConfig.html`)

## Market Scan Notes (2026-02-09 cycle 5 refresh)
- Many Mermaid editors explicitly market: autosave, zoom/pan, share links, and export to PNG/SVG/PDF as baseline expectations; several also push collaboration. Sources:
  - Mermaid Viewer docs (export/share/autosave/collaboration). (source: `https://docs.mermaidviewer.com/mermaid-viewer/how-to-use.html`)
  - Online Mermaid Viewer markets export SVG/PNG + URL share + pan + fullscreen link. (source: `https://mermaid-viewer.com/`)
  - Mermaid Visualizer includes share/save/load + PNG/PDF export settings. (source: `https://viewmermaid.com/`)

## Verification Evidence (2026-02-09)
- `make check` -> pass (lint, typecheck, tests, build, audit)
- `npm run test` -> pass (8 files, 23 tests)
- `make smoke` -> pass (Playwright UI flow)
- GitHub Actions: `gh run watch 21832982062 --exit-status` -> success
- GitHub Actions: `gh run watch 21833013633 --exit-status` -> success
- GitHub Actions: `gh run watch 21817195219 --exit-status` -> success
- GitHub Actions: `gh run watch 21817255094 --exit-status` -> success
- Local smoke path: `npm run preview -- --host 127.0.0.1 --port 4173` + `curl` content checks (`generate-patch`, `ai-api-base`, `undo-patch`) -> pass

## Notes
- This file is maintained by the autonomous clone loop.
