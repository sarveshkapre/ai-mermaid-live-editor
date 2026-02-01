# PLAN

Planning memory lives in `/PLAN.md` (this file is a longer-form design note).

## MVP scope
- Split editor + live Mermaid renderer.
- AI panel that produces patch proposals with diff preview.
- Commit timeline with restore and diff on demand.
- Shareable links via URL hash.
- SVG/PNG export.

## Stack choice
- Vite (vanilla JS)
- Mermaid.js for rendering
- Vitest for unit tests
- ESLint + TypeScript (check JS)

## Architecture
- `src/main.js`: UI wiring, state, render loop.
- `src/lib/diff.js`: line diff generator.
- `src/lib/hash.js`: URL hash encode/decode.
- `src/lib/history.js`: commit timeline storage.

## Milestones
1. Scaffold repo + CI + Makefile
2. Implement editor + renderer + diff
3. Implement AI patch panel + history + exports
4. Tests + security pass + docs polish

## MVP checklist
- [x] Live render with error output
- [x] AI patch panel with diff preview
- [x] Apply patch + commit timeline
- [x] Shareable links
- [x] SVG/PNG export
- [x] `make check` green

## Risks
- Mermaid syntax errors should not break UI.
- Large diagrams may slow render/diff.

## Non-goals
- Multi-user collaboration
- Cloud storage or auth
