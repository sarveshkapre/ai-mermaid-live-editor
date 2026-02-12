# Incidents

This log tracks real failures/regressions and the prevention rules that come out of them.

## 2026-02-09
- No incidents recorded in this cycle.

## 2026-02-11
- Build-time reliability incident (local): new `src/lib/mermaid-lint.js` failed strict `tsc --noEmit` due to an untyped accumulator array widening `severity` to `string`.
  - Root cause: missing JSDoc type annotation on `issues` array in a `checkJs` strict file.
  - Remediation: annotate with `/** @type {MermaidLintIssue[]} */` and rerun full checks.
  - Prevention rule: pre-type all mutable accumulators in strict JS modules before pushing typed objects.

### 2026-02-12T20:01:06Z | Codex execution failure
- Date: 2026-02-12T20:01:06Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-2.log
- Commit: pending
- Confidence: medium
