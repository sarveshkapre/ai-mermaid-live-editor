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

### 2026-02-12T20:04:35Z | Codex execution failure
- Date: 2026-02-12T20:04:35Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-3.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:08:03Z | Codex execution failure
- Date: 2026-02-12T20:08:03Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-4.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:11:33Z | Codex execution failure
- Date: 2026-02-12T20:11:33Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-5.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:15:00Z | Codex execution failure
- Date: 2026-02-12T20:15:00Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-6.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:18:32Z | Codex execution failure
- Date: 2026-02-12T20:18:32Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-7.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:21:58Z | Codex execution failure
- Date: 2026-02-12T20:21:58Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-8.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:25:29Z | Codex execution failure
- Date: 2026-02-12T20:25:29Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-9.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:29:05Z | Codex execution failure
- Date: 2026-02-12T20:29:05Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-10.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:32:35Z | Codex execution failure
- Date: 2026-02-12T20:32:35Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-11.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:36:03Z | Codex execution failure
- Date: 2026-02-12T20:36:03Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-12.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:39:34Z | Codex execution failure
- Date: 2026-02-12T20:39:34Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-13.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:43:01Z | Codex execution failure
- Date: 2026-02-12T20:43:01Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-14.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:46:33Z | Codex execution failure
- Date: 2026-02-12T20:46:33Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-15.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:50:02Z | Codex execution failure
- Date: 2026-02-12T20:50:02Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-16.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:53:31Z | Codex execution failure
- Date: 2026-02-12T20:53:31Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-17.log
- Commit: pending
- Confidence: medium

### 2026-02-12T20:57:07Z | Codex execution failure
- Date: 2026-02-12T20:57:07Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-18.log
- Commit: pending
- Confidence: medium

### 2026-02-12T21:00:36Z | Codex execution failure
- Date: 2026-02-12T21:00:36Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-19.log
- Commit: pending
- Confidence: medium

### 2026-02-12T21:04:02Z | Codex execution failure
- Date: 2026-02-12T21:04:02Z
- Trigger: Codex execution failure
- Impact: Repo session did not complete cleanly
- Root Cause: codex exec returned a non-zero status
- Fix: Captured failure logs and kept repository in a recoverable state
- Prevention Rule: Re-run with same pass context and inspect pass log before retrying
- Evidence: pass_log=logs/20260212-101456-ai-mermaid-live-editor-cycle-20.log
- Commit: pending
- Confidence: medium
