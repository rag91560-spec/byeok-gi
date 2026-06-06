# Release Process

This checklist is for public Varo releases and packaged Windows builds.

## Pre-Release

- Confirm `git status -sb` is clean or contains only intended release changes.
- Review `git diff --name-status origin/master..HEAD`.
- Run the history/privacy gate from `docs/security-history-review.md` before pushing public changes.
- Update `CHANGELOG.md`.
- Confirm `package.json` version and release notes match.
- Confirm no generated output, local databases, logs, game extraction output, cookies, browser profiles, or private keys are tracked.

## Local Verification

Run the smallest useful checks for the release scope:

```bash
npm run lint
npm run build
```

For packaged release candidates:

```bash
npm run electron:build
```

The Electron build runs:

```bash
node scripts/verify-build-inputs.js
```

This prevents an installer from being produced when required build inputs are missing.

## Packaging Notes

The package build expects:

- `build/icon.ico`
- `build/installer.nsh`
- `dist/backend-dist`
- `build-staging/frontend`
- the configured `ue-translator` source directory

Do not commit packaged installers, unpacked app directories, database files, logs, or extracted game assets.

## Post-Release

- Publish release notes.
- Verify the public download/update endpoint serves the expected version.
- Announce the release in the configured community channels.
- Watch for compatibility reports and regressions.
- Convert reproducible Discord reports into GitHub issues.
