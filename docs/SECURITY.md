# SECURITY

## Reporting
Report non-sensitive issues via GitHub issues. For sensitive issues, contact the maintainer privately.

## Threat model (MVP)
- Local-first app; all data stays in browser storage.
- No auth or multi-tenant features.
- No network calls except optional Mermaid assets.

## Mitigations
- URL hash encoding only; no server storage.
- Strict input handling for patch apply.
