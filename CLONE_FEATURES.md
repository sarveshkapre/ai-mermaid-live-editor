# Clone Feature Tracker

## Context Sources
- README and docs (`PLAN.md`, `docs/ROADMAP.md`, `docs/PROJECT.md`)
- GitHub Actions failures: runs `21702497753` and `21579298912`
- Local baseline check (`make check`)
- Quick code review sweep in `src/main.js` and `src/lib/*`

## Candidate Features To Do
- [ ] P0 (Selected): Track the repo operating contract in root `AGENTS.md` (ensure it is versioned and current).
- [ ] P1 (Selected): Security hardening: set Mermaid `securityLevel: "strict"` and lock secure config keys to prevent malicious graph directives from overriding defaults.
- [ ] P1 (Selected): UX parity: space-drag pan in preview + persist zoom between reloads.
- [ ] P2 (Selected): Import Mermaid from file (`.mmd`/`.md`/`.txt`) into a new tab (safe size limits + filename-based tab title).
- [ ] P1: Integrate a real OpenAI-compatible patch generation flow (provider settings, safe request/response parsing, strict output format).
- [ ] P2: Add browser-level smoke automation (Playwright) for render + patch apply + tab lifecycle.
- [ ] P2: Add import from URL (hash/query param) with validation and optional “open as new tab”.
- [ ] P3: Add PDF export (print-friendly output + consistent sizing).
- [ ] P3: Add “format Mermaid” action (basic pretty-print) with a non-destructive preview.
- [ ] P3: Add a lightweight presentation mode (full-screen with step-through snapshots).

## Implemented
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

## Insights
- Both failing GitHub runs were rooted in strict TS checks (`checkJs`) after state-heavy features landed in `src/main.js`.
- Startup state was previously trusting raw localStorage arrays; corrupted entries could silently poison runtime state.
- Blocking invalid Mermaid proposals before apply avoids accidental overwrite of valid diagrams and improves trust in AI patch flow.
- Mermaid is now split into a separate `mermaid.core-*.js` chunk, keeping the initial `index-*.js` small for faster first paint.
- `renderMermaid()` is async; adding a monotonic render sequence prevents older renders from overwriting newer edits.

## Market Scan Notes (2026-02-09)
- Baseline expectations for Mermaid editors in the wild include: URL sharing, export to PNG/SVG (often PDF too), themes, autosave/recovery, and (in some products) collaboration/comments/presentations. Sources:
  - Mermaid Chart highlights collaboration, comments, and presentation mode as product features. See Mermaid’s ecosystem page. (source: `https://mermaid.js.org/ecosystem/mermaid-chart.html`)
  - Some Mermaid editor products market annotations/highlights and multi-format export + URL share as “power features”. (example: `https://modern-mermaid.live/features.html`, `https://modern-mermaid.live/docs/`)
- Mermaid security configuration supports `securityLevel` and “secure config keys” to prevent diagram directives from overriding site defaults; this matters for share links and pasted content. (source: `https://mermaid.js.org/config/schema-docs/config`, `https://mermaid.js.org/config/setup/mermaid/interfaces/MermaidConfig.html`)

## Verification Evidence (2026-02-09)
- `make check` -> pass (lint, typecheck, tests, build, audit)
- `npm run test` -> pass (6 files, 16 tests)
- `npm run build` -> pass (Mermaid split into `mermaid.core-*.js`, initial `index-*.js` ~37 kB)
- GitHub Actions: `gh run watch 21811569637 --exit-status` -> success
- Local smoke path: `npm run preview -- --host 127.0.0.1 --port 4173` + `curl` content checks (`AI patch studio`, `Starter templates`, `download-export-history`) -> pass

## Notes
- This file is maintained by the autonomous clone loop.
