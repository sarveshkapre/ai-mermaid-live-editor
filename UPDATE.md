# Update (2026-02-01)

## What changed
- Added a keyboard shortcuts dialog (`?` to open) and improved focus-visible styling.
- Improved “Copy share link” reliability with feedback, clipboard fallback, and URL hash sync without history spam.
- Kept diff preview in sync as the editor content changes.
- Added a smoke test to ensure `index.html` includes required element IDs.
- Added draft autosave plus restore/clear controls to prevent refresh data loss.
- Added copy/download Mermaid source actions.
- Added PNG export controls for scale and transparent background with saved preferences.
- Added guardrails for large diagrams: auto-render pauses with manual “Render now” and huge diffs are skipped.
- Added SVG export controls for scale and optional inline styles with saved preferences.
- Added export width presets (auto/small/medium/large/custom) applied to PNG and SVG.

## How to verify
```bash
make check
```

## PR
- If `gh` is installed and authenticated: create a PR from your branch and paste the link here.
- Otherwise: `git push -u origin <branch>` then open a PR in GitHub with the commit message as the title.
