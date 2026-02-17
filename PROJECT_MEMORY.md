# Project Memory

Structured, append-only notes for decisions and learnings that should persist across maintenance sessions.

## Decisions

### 2026-02-11: Ship In-Editor Mermaid Lint Assistant With Non-Destructive Quick Fixes
- Decision: Add a lint assistant that detects high-frequency Mermaid mistakes (fenced markdown blocks, smart quotes, tab indentation, flowchart `->` typos, and missing `end` for `subgraph`) and stage fixes into Patch proposal instead of mutating the editor directly.
- Why: This closes the roadmap’s top missing feature while preserving the product’s patch-first trust model (review diff before apply).
- Evidence: `src/lib/mermaid-lint.js`, `src/main.js`, `index.html`, `src/styles.css`, `tests/mermaid-lint.test.js`, `tests/dom-ids.test.js`; `make check` pass; `make smoke` pass.
- Commit: `fbfba2c`
- Confidence: high
- Trust label: trusted (local code/tests)

### 2026-02-09: Add Snapshot Presentation Mode
- Decision: Add a lightweight presentation mode (full-screen dialog) that steps through the snapshot timeline with keyboard navigation (`P`, arrow keys) and timeline “Present” entry points.
- Why: Presentation is a common expectation for diagram editors and makes snapshot history immediately useful for reviews and demos.
- Evidence: `make check` pass; `make smoke` pass; UI in `index.html` + render loop in `src/main.js`.
- Commit: `eb3e3e6`
- Confidence: high
- Trust label: local verification

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

### 2026-02-09: Add OpenAI-Compatible Patch Generation + Undo
- Decision: Add an optional OpenAI-compatible “Generate AI patch” flow with provider settings, safe response parsing, Mermaid extraction, and a one-click “Undo patch” restore after apply.
- Why: “Simulate patch” is useful for demos, but real provider integration is required for product value; undo reduces risk of applying a bad patch.
- Evidence: `src/main.js`, `src/lib/ai-patch.js`, `index.html`, `tests/ai-patch.test.js`; `make check` pass; CI run `21817195219` success.
- Commit: `5502d2c`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Add Local AI Proxy Script For CORS + Key Hygiene
- Decision: Add `scripts/ai-proxy.mjs` to forward `/v1/*` calls to an upstream OpenAI-compatible endpoint with permissive CORS, using `OPENAI_API_KEY` from the environment when present.
- Why: Browser-to-provider calls often fail due to CORS and encourage insecure API key storage; a local proxy keeps keys out of the browser by default.
- Evidence: `scripts/ai-proxy.mjs`, `README.md`, `eslint.config.js`; proxy-forwarding smoke check against a local stub upstream; CI run `21817255094` success.
- Commit: `4509885`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Import Mermaid From URL Into A New Tab
- Decision: Add a non-destructive “Import from URL” flow that can fetch remote Mermaid text or decode this app’s share links into a new tab.
- Why: Import-from-URL is baseline parity for editors and removes friction when diagrams live in repos, gists, or chat threads.
- Evidence: `src/main.js`, `index.html`, `tests/dom-ids.test.js`; `make check` pass.
- Commit: `9bd9917`
- Confidence: medium
- Trust label: local verification
- Follow-ups: Consider a dedicated UI dialog (instead of `prompt`) and clearer CORS error help text.

### 2026-02-09: Add AI Generation Controls + Cancel
- Decision: Persist AI generation settings (temperature/max tokens/timeout) and support canceling in-flight patch generation.
- Why: Users need control over determinism/cost/latency; cancel prevents “stuck” UI during slow provider responses.
- Evidence: `src/main.js`, `index.html`, `src/styles.css`, `tests/dom-ids.test.js`; `make check` pass.
- Commit: `8c1d12a`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Add Playwright Browser Smoke Script
- Decision: Add an optional Playwright-driven UI smoke script that builds, previews, and exercises core flows (render, patch apply/undo, tabs).
- Why: Unit tests can’t catch DOM wiring/regressions in real user flows; a smoke script provides fast end-to-end confidence.
- Evidence: `scripts/smoke-browser.mjs`, `package.json`, `Makefile`; `make smoke` pass.
- Commit: `af4e302`
- Confidence: medium
- Trust label: local verification

### 2026-02-09: Add PDF Export Via Browser Print
- Decision: Export diagrams as PDF by opening a print-friendly window and invoking `window.print()` (users save to PDF), with lightweight page/margin/background controls.
- Why: PDF export is parity for Mermaid editors; using print keeps dependencies low and works offline without server-side rendering.
- Evidence: `index.html`, `src/main.js`; `make check` pass; `make smoke` pass.
- Commit: `b452332`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Share Links That Import Into A New Tab + Clean URLs
- Decision: Add explicit “Copy link (new tab)” and “Copy snapshot (import)” actions and clear one-shot import/read-only URL flags after importing.
- Why: Opening share links should not destructively overwrite the active tab; cleaning URL params avoids confusing reload behavior.
- Evidence: `index.html`, `src/main.js`, `README.md`; `make check` pass.
- Commit: `b452332`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Replace `prompt()` URL Import With A Modal Dialog
- Decision: Use an in-app `<dialog>` for “Import from URL” instead of `window.prompt()`.
- Why: `prompt()` is brittle and inconsistent across browsers; a modal improves UX and supports better copy/paste flows.
- Evidence: `index.html`, `src/main.js`, `src/styles.css`, `tests/dom-ids.test.js`; `make check` pass.
- Commit: `b452332`
- Confidence: high
- Trust label: local verification

### 2026-02-09: Add “Format Mermaid” (Safe Whitespace Normalization) With Diff Preview
- Decision: Provide a low-risk formatter that stages output into Patch proposal so users can review the diff before applying.
- Why: A “format” button is expected parity; non-destructive preview reduces risk of breaking diagrams.
- Evidence: `index.html`, `src/main.js`; `make check` pass.
- Commit: `b452332`
- Confidence: medium
- Trust label: local verification

### 2026-02-10: Stream AI Patch Output (SSE) + Usage Metadata (When Available)
- Decision: Prefer OpenAI-compatible SSE streaming (`stream: true`) for AI patch generation to progressively fill the proposal textarea; capture and display usage metadata when providers include it; automatically fall back to non-streaming when endpoints reject streaming parameters.
- Why: Progressive fill reduces perceived latency for long patches and makes failures/cancellations less opaque; fallback preserves compatibility with “OpenAI-compatible” providers that don't implement streaming.
- Evidence: `make check` pass; `make smoke` pass; proxy streaming pass-through smoke (`chunks=3`) pass; CI run `21859598842` success.
- Commit: `c10638e`
- Confidence: medium
- Trust label: local verification

## Mistakes And Fixes

### 2026-02-11: New Lint Module Failed Strict Typecheck Due To Untyped Issue Array
- Mistake: `src/lib/mermaid-lint.js` initially declared `const issues = []`, which widened `severity` to `string` and failed `tsc --noEmit`.
- Root cause: In JS + JSDoc mode, array literals without explicit typing lose intended string-literal unions when objects are pushed incrementally.
- Fix: Added `/** @type {MermaidLintIssue[]} */` for `issues`.
- Prevention rule: In strict `checkJs` files, explicitly annotate accumulator arrays/objects at declaration time.

### 2026-02-09: Smoke Test Waited For Closed Dialog To Become Visible
- Mistake: Browser smoke check waited for `#presentation-dialog:not([open])` to be visible, but a closed `<dialog>` is hidden so the selector never became visible.
- Root cause: Misunderstood Playwright `waitForSelector` defaults (visibility) and `<dialog>` open/close mechanics.
- Fix: Wait for `#presentation-dialog[open]` to become detached instead.
- Prevention rule: For dialog close checks, prefer waiting for the `[open]` selector to detach (or poll `getAttribute("open")`) rather than relying on visibility.

### 2026-02-09: Missing JSDoc Type For New Helper Caused `tsc --noEmit` Failure
- Mistake: Added `isTypingElement(target)` without a JSDoc `@param` type, triggering `checkJs` implicit-`any` errors.
- Root cause: TypeScript `checkJs` requires explicit JSDoc typing for new untyped parameters in strict mode.
- Fix: Added `/** @param {unknown} target */` in `src/main.js`.
- Prevention rule: Run `make check` before every push (already policy); keep new helpers JSDoc-typed by default.

### 2026-02-09: ESLint Scripts Glob Missed `.mjs` Files
- Mistake: Added a Node script as `.mjs` but ESLint config only matched `scripts/**/*.js`, causing `no-undef` failures for Node globals.
- Root cause: `eslint.config.js` file globs did not include `.mjs`.
- Fix: Updated scripts config to `scripts/**/*.{js,mjs}`.
- Prevention rule: When adding new executable scripts, ensure ESLint/TS configs include their extensions (prefer `.js` under `"type": "module"` unless `.mjs` is required).

### 2026-02-09: Smoke Script Used Browser-Context Globals In Node File (ESLint `no-undef`)
- Mistake: Initial Playwright smoke script used `document` inside `page.waitForFunction(() => ...)`, triggering `no-undef` in Node linting.
- Root cause: ESLint correctly linted `scripts/*.mjs` as Node code; the callback is still defined in Node scope even if executed in the browser.
- Fix: Switched to Playwright selectors, `page.textContent()`, `page.inputValue()`, and polling loops without referencing browser globals.
- Prevention rule: Avoid `document/window` references in Node scripts; use selector-based Playwright APIs or string-evaluated functions if needed.

## Verification Evidence (2026-02-09)
- `make check` -> pass
- `make smoke` -> pass (post presentation mode)
- `npm run preview -- --host 127.0.0.1 --port 4173` -> pass
- `curl -fsSL http://127.0.0.1:4173/ | rg -n "AI patch studio|Starter templates|import-file-btn|download-export-history|shortcuts-dialog"` -> pass
- `gh run watch 21811936755 --exit-status` -> success
- `gh run watch 21841943891 --exit-status` -> success
- `make check` -> pass (post AI patch generation + proxy)
- `npm run preview -- --host 127.0.0.1 --port 4173` -> pass
- `curl -fsSL http://127.0.0.1:4173/ | rg -n "generate-patch|ai-api-base|ai-model|ai-api-mode|ai-api-key|ai-remember-key|undo-patch|patch-undo"` -> pass
- `gh run watch 21817195219 --exit-status` -> success
- `gh run watch 21817255094 --exit-status` -> success
- Proxy-forwarding smoke (stub upstream + proxy + curl) -> pass
  Command:
  ```bash
  node --input-type=module -e 'import http from "node:http";
    const server = http.createServer((req,res)=>{
      if (req.method==="POST" && req.url==="/v1/chat/completions") {
        res.setHeader("Content-Type","application/json");
        res.end(JSON.stringify({choices:[{message:{content:"flowchart TD\n  a-->b"}}]}));
        return;
      }
      if (req.method==="POST" && req.url==="/v1/responses") {
        res.setHeader("Content-Type","application/json");
        res.end(JSON.stringify({output:[{type:"message",content:[{type:"output_text",text:"flowchart TD\n  a-->b"}]}]}));
        return;
      }
      res.statusCode = 404; res.end("not found");
    });
    server.listen(9999,"127.0.0.1",()=>console.log("stub up"));
    setInterval(()=>{},1000);' >/tmp/ai-mermaid-stub.log 2>&1 & echo $! > /tmp/ai-mermaid-stub.pid
  PORT=8788 AI_PROXY_TARGET_ORIGIN=http://127.0.0.1:9999 node scripts/ai-proxy.mjs >/tmp/ai-mermaid-proxy.log 2>&1 & echo $! > /tmp/ai-mermaid-proxy.pid
  sleep 0.8
  curl -fsS -D /tmp/ai-mermaid-proxy.headers -o /tmp/ai-mermaid-proxy.body \
    -H 'Content-Type: application/json' \
    -d '{"model":"x","messages":[]}' \
    http://127.0.0.1:8788/v1/chat/completions
  rg -n "access-control-allow-origin: \\*" /tmp/ai-mermaid-proxy.headers
  node --input-type=module -e 'import fs from "node:fs";
    const body = JSON.parse(fs.readFileSync("/tmp/ai-mermaid-proxy.body","utf8"));
    if (!body?.choices?.[0]?.message?.content) process.exit(2);
    console.log("ok");'
  kill $(cat /tmp/ai-mermaid-proxy.pid) $(cat /tmp/ai-mermaid-stub.pid)
  rm -f /tmp/ai-mermaid-proxy.pid /tmp/ai-mermaid-stub.pid /tmp/ai-mermaid-proxy.headers /tmp/ai-mermaid-proxy.body
  ```

## Verification Evidence (2026-02-09 cycle 3)
- `make check` -> pass
- `make smoke` -> pass
- `gh run watch 21824678395 --exit-status` -> success
- `gh run watch 21824700846 --exit-status` -> success

## Verification Evidence (2026-02-09 cycle 4)
- `make check` -> pass
- `make smoke` -> pass
- `gh run watch 21832982062 --exit-status` -> success
- `gh run watch 21833013633 --exit-status` -> success

## Verification Evidence (2026-02-10 cycle 1)
- `make check` -> pass
- `make smoke` -> pass
- Proxy streaming pass-through smoke (stub upstream + proxy + fetch stream) -> pass (`chunks=3`)
  Command:
  ```bash
  node --input-type=module -e 'import http from "node:http";
    const server = http.createServer((req,res)=>{
      if (req.method==="POST" && req.url==="/v1/chat/completions") {
        res.writeHead(200, {"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});
        res.write(`data: ${JSON.stringify({choices:[{delta:{content:"flowchart TD\\n"}}]})}\\n\\n`);
        setTimeout(()=>res.write(`data: ${JSON.stringify({choices:[{delta:{content:"  a-->b\\n"}}]})}\\n\\n`),50);
        setTimeout(()=>{res.write(`data: ${JSON.stringify({choices:[{delta:{}}],usage:{prompt_tokens:1,completion_tokens:2,total_tokens:3}})}\\n\\n`);res.write("data: [DONE]\\n\\n");res.end();},100);
        return;
      }
      res.statusCode = 404; res.end("not found");
    });
    server.listen(9998,"127.0.0.1",()=>console.log("stub up"));
    setInterval(()=>{},1000);' >/tmp/ai-mermaid-stub-stream.log 2>&1 & echo $! > /tmp/ai-mermaid-stub-stream.pid
  PORT=8790 AI_PROXY_TARGET_ORIGIN=http://127.0.0.1:9998 node scripts/ai-proxy.mjs >/tmp/ai-mermaid-proxy-stream.log 2>&1 & echo $! > /tmp/ai-mermaid-proxy-stream.pid
  sleep 0.4
  node --input-type=module -e 'const res = await fetch("http://127.0.0.1:8790/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    let chunks=0; for await (const _ of res.body) chunks+=1; console.log(`chunks=${chunks}`); if (chunks<2) process.exit(3);'
  kill $(cat /tmp/ai-mermaid-proxy-stream.pid) $(cat /tmp/ai-mermaid-stub-stream.pid)
  ```
- GitHub Actions: `gh run watch 21859598842 --exit-status` -> success

## Verification Evidence (2026-02-11 cycle 1)
- `gh issue list --limit 50 --state open --json number,title,author,labels,updatedAt,url` -> pass (`[]`, no open issues by trusted authors/bots).
- `gh run list --limit 12 --json databaseId,headBranch,headSha,name,conclusion,status,event,workflowName,updatedAt,url` -> pass (recent completed runs all `success`).
- `npm run test` -> pass (11 files, 34 tests).
- `npm run lint` -> pass.
- `npm run typecheck` -> pass.
- `make check` -> pass.
- `make smoke` -> pass.
- Local smoke path:
  - `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` -> pass.
  - `curl -fsSL http://127.0.0.1:4173/ | rg -n "lint-mermaid|lint-stage-fixes|lint-status|lint-issues"` -> pass.
- GitHub Actions: `gh run watch 21897363082 --exit-status` -> success.

## Decisions

### 2026-02-17: Complete Template/Navigation/Reliability Backlog With Ten Incremental Commits
- Decision: Implement ten scoped improvements focused on highest-impact usability gaps: personal template lifecycle (save/update/rename/delete), template import/export, tab search + tags + keyboard quick-switch, large-diff summary fallback, URL import diagnostics, storage failure resilience, and expanded starter templates (gantt/ER/timeline).
- Why: These were the clearest open product gaps for repeated real usage and are aligned with current Mermaid editor expectations (template reuse, multi-diagram navigation, robust imports).
- Evidence: `src/main.js`, `src/lib/diff.js`, `src/lib/tabs.js`, `src/lib/draft.js`, `src/lib/history.js`, `index.html`, `src/styles.css`, `tests/diff.test.js`, `tests/tabs.test.js`, `tests/draft.test.js`, `tests/history.test.js`, `tests/dom-ids.test.js`, `README.md`.
- Commits: `f6876d6`, `a2d632e`, `5ae9842`, `7bcd588`, `e689978`, `6d6b8c4`, `b6bb93c`, `39ad944`, `25f4ad1`, `pending`.
- Confidence: high
- Trust label: local verification

## Verification Evidence (2026-02-17 cycle 1)
- `make check` -> fail (`npm run typecheck` reported two errors in `src/main.js`: nullable template-array narrowing and a snapshot tab object missing required `tags`).
- `make check` -> pass (lint, typecheck, tests, build, and audit all successful).
