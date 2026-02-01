# AGENTS

## Purpose
AI Mermaid Live Editor is a local-first Mermaid editor with live render, patch-based AI changes, and a lightweight commit timeline.

## Guardrails
- No auth; single-user/local-first only.
- Avoid external telemetry.
- Keep dependencies minimal and front-end focused.

## Commands
- `make setup` – install dependencies
- `make dev` – run Vite dev server
- `make check` – lint, typecheck, test, build, security

## Conventions
- Plain JS with typechecked JSDoc where needed.
- UI state lives in `src/main.js`; small helpers in `src/lib/`.
