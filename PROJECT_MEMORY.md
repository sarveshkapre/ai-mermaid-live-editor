# Project Memory

Structured, append-only notes for decisions and learnings that should persist across maintenance sessions.

## Decisions

### 2026-02-09: Lazy-load Mermaid To Shrink Initial Bundle
- Decision: Load Mermaid via dynamic import and centralize initialization in `src/lib/mermaid-loader.js`.
- Why: Mermaid is the dominant dependency; deferring it improves first paint for users who are editing before previewing.
- Evidence: `make check` pass; `npm run build` shows Mermaid in its own `dist/assets/mermaid.core-*.js` chunk and a small initial `index-*.js`.
- Commit: `67be431`
- Confidence: high
- Trust label: local verification
- Follow-ups: consider adding a lightweight render skeleton while Mermaid loads for the first time.

### 2026-02-09: Prevent Stale Async Renders From Overwriting Newer Edits
- Decision: Use a monotonic render sequence (`renderSeq`) to ensure only the latest `renderMermaid()` call updates the preview.
- Why: `renderMermaid()` is async; without a guard, slow renders could race and regress UX on fast typing.
- Evidence: Implemented in `src/main.js`; covered by `make check` and manual preview smoke.
- Commit: `67be431`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Save Restore Point Before Applying Patches
- Decision: Automatically add a snapshot (`Auto: before patch`) before mutating the editor via Apply Patch.
- Why: Patch application should never feel irreversible; the timeline already provides a one-click restore.
- Evidence: `src/main.js`; `make check` pass.
- Commit: `c1e7ab7`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Export History JSON Download
- Decision: Add “Download export history JSON” using the existing `ai-mermaid-export-history` localStorage payload.
- Why: Users often want to report or archive export attempts separately from diagram snapshots.
- Evidence: `index.html`, `src/main.js`, `tests/dom-ids.test.js`; preview smoke includes `download-export-history`.
- Commit: `89360fc`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Diff Performance Trim (Prefix/Suffix)
- Decision: Trim common prefix/suffix lines before the DP diff to reduce time/memory on typical edits.
- Why: The DP LCS approach is O(n*m); trimming preserves correctness and improves common-case performance without a full algorithm swap.
- Evidence: `src/lib/diff.js`, `tests/diff.test.js`; `make check` pass.
- Commit: `2001ff9`
- Confidence: high
- Trust label: unit-tested

### 2026-02-09: Default Mermaid To Strict Security + Lock Secure Keys
- Decision: Initialize Mermaid with `securityLevel: "strict"` and lock secure config keys so inline init directives cannot weaken defaults.
- Why: This app renders pasted/share-linked content; a strict baseline reduces XSS risk and keeps site-level security consistent.
- Evidence: `src/lib/mermaid-loader.js`, `tests/mermaid-loader.test.js`; `make check` pass.
- Commit: `c6dcede`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Persist Preview Zoom + Space-Drag Pan
- Decision: Persist preview zoom via localStorage and add space-drag panning on the preview surface.
- Why: Large diagrams are otherwise frustrating to navigate; these controls are common parity features in diagram editors.
- Evidence: `src/main.js`, `src/styles.css`, `index.html`; local preview smoke + `curl` checks.
- Commit: `5c300e3`
- Confidence: medium
- Trust label: local verification

### 2026-02-09: Import Mermaid Files Into A New Tab
- Decision: Add file import for `.mmd`/`.md`/`.txt`, creating a new tab with size limits and filename-based titles.
- Why: Import is a core workflow for Mermaid editors; “new tab” avoids destructive overwrites and pairs well with the existing tab UX.
- Evidence: `src/main.js`, `index.html`, `tests/dom-ids.test.js`; `make check` pass.
- Commit: `b4dae83`
- Confidence: high
- Trust label: local verification

## Mistakes And Fixes

### 2026-02-09: Missing JSDoc Type For New Helper Caused `tsc --noEmit` Failure
- Mistake: Added `isTypingElement(target)` without a JSDoc `@param` type, triggering `checkJs` implicit-`any` errors.
- Root cause: TypeScript `checkJs` requires explicit JSDoc typing for new untyped parameters in strict mode.
- Fix: Added `/** @param {unknown} target */` in `src/main.js`.
- Prevention rule: Run `make check` before every push (already policy); keep new helpers JSDoc-typed by default.

## Verification Evidence (2026-02-09)
- `make check` -> pass
- `npm run preview -- --host 127.0.0.1 --port 4173` -> pass
- `curl -fsSL http://127.0.0.1:4173/ | rg -n "AI patch studio|Starter templates|import-file-btn|download-export-history|shortcuts-dialog"` -> pass
- `gh run watch 21811936755 --exit-status` -> success
