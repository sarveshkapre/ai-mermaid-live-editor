# Self-Hosted GitHub Actions Runner Setup

This repository CI workflow now runs only on `self-hosted` runners.

## Runner host requirements

Install these on the runner machine before registration:

- `git` (required by `actions/checkout`)
- `bash` (recommended shell for troubleshooting and manual validation)
- Node.js toolcache download access (or preinstalled Node 20.x if your environment is offline)
- Outbound HTTPS access to:
  - `github.com`
  - `api.github.com`
  - `objects.githubusercontent.com`
  - `registry.npmjs.org`

Notes:

- Docker is **not required** for this workflow.
- Linux and macOS runners are recommended.

## Register a runner (repository-level)

1. Open this repository on GitHub.
2. Go to **Settings → Actions → Runners**.
3. Click **New self-hosted runner**.
4. Choose your OS and architecture.
5. Run the generated commands on your machine:
   - Create runner directory
   - Download/extract runner package
   - Configure with URL + registration token
6. Start runner:
   - Foreground: `./run.sh`
   - Service (recommended): `sudo ./svc.sh install && sudo ./svc.sh start`

Keep at least one runner online and idle for this repository.

## Validate end-to-end on the runner machine

From the repository root:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run audit
```

If all commands pass locally on the runner host, push a commit and confirm the `ci` workflow completes under **Actions**.
