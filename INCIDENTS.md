# Incidents

This log tracks real failures/regressions and the prevention rules that come out of them.

## 2026-02-09
- No incidents recorded in this cycle.

## 2026-02-11
- Build-time reliability incident (local): new `src/lib/mermaid-lint.js` failed strict `tsc --noEmit` due to an untyped accumulator array widening `severity` to `string`.
  - Root cause: missing JSDoc type annotation on `issues` array in a `checkJs` strict file.
  - Remediation: annotate with `/** @type {MermaidLintIssue[]} */` and rerun full checks.
  - Prevention rule: pre-type all mutable accumulators in strict JS modules before pushing typed objects.
