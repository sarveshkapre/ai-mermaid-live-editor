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

