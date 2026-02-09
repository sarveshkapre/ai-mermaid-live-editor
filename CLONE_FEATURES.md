# Clone Feature Tracker

## Context Sources
- README and docs (`PLAN.md`, `docs/ROADMAP.md`, `docs/PROJECT.md`)
- GitHub Actions failures: runs `21702497753` and `21579298912`
- Local baseline check (`make check`)
- Quick code review sweep in `src/main.js` and `src/lib/*`

## Candidate Features To Do
- [ ] P0: Reduce initial JS bundle size by lazy-loading Mermaid and splitting build chunks (faster first paint).
- [ ] P1: Add export-history JSON download for recent exports (separate from commit timeline export).
- [ ] P1: Add “pre-patch restore point” UX (automatic snapshot before apply + one-click restore hint).
- [ ] P1: Integrate a real OpenAI-compatible patch generation flow (provider settings, safe request/response parsing, strict output format).
- [ ] P2: Improve diff performance for medium/large diagrams (prefix/suffix trimming, memory caps) while keeping guardrails.
- [ ] P2: Add drag-to-pan preview plus zoom persistence for large diagrams (parity with common editors).
- [ ] P2: Add browser-level smoke automation (Playwright) for render + patch apply + tab lifecycle.
- [ ] P3: Add PDF export (print-friendly output + consistent sizing).
- [ ] P3: Add import from file (load `.mmd`/`.md`) and from URL (hash or query param) with validation.
- [ ] P3: Add “format Mermaid” action (basic pretty-print) with a non-destructive preview.

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

## Insights
- Both failing GitHub runs were rooted in strict TS checks (`checkJs`) after state-heavy features landed in `src/main.js`.
- Startup state was previously trusting raw localStorage arrays; corrupted entries could silently poison runtime state.
- Blocking invalid Mermaid proposals before apply avoids accidental overwrite of valid diagrams and improves trust in AI patch flow.
- Build currently emits a >500 kB chunk warning (`dist/assets/index-*.js`), so lazy-loading Mermaid modules is now a clear perf opportunity.

## Verification Evidence (2026-02-08)
- `npm run typecheck` -> pass
- `npm run lint` -> pass
- `npm run test` -> pass (6 files, 15 tests)
- `npm run build` -> pass
- `npm run audit` -> pass (`high=0`, `critical=0`)
- `make check` -> pass
- Local smoke path: `npm run preview -- --host 127.0.0.1 --port 4173` + `curl` checks for `Starter templates`, `AI patch studio`, `id="apply-patch"` -> pass

## Notes
- This file is maintained by the autonomous clone loop.
