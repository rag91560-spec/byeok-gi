# Changelog

All notable public repository changes are tracked here. Dates use UTC.

## Unreleased

## 1.4.4 RC - 2026-06-06

- Stabilized visible library, live capture, subtitle, audio, video, manga, and settings UI surfaces for the v1.4.4 release candidate.
- Improved Korean/English UI switching, localized known live-capture error messages, and normalized visible Varo branding.
- Unified library card, hover, selected, layout, and empty-state treatments across the main media surfaces.
- Fixed Electron/Next theme hydration behavior that could show development hydration warnings.
- Fixed packaged macOS Electron startup so the bundled Next frontend runs from the packaged resource directory.
- Staged packaged frontend dependencies under the correct macOS app resource path.
- Kept the external game translation engine as a required package input without committing its source into the public repository.
- Cleaned public README and repository metadata for OSS review readiness.
- Added governance docs, security reporting guidance, issue templates, release process, impact evidence, roadmap, and Codex OSS application draft.
- Added a security-history review note for previously tracked browser profile artifacts.
- Added build-input verification for packaged Electron releases.

## 1.4.3 - 2026-05-31

- Prepared accumulated translator, Electron, API proxy, Discord operations, and release-input maintenance work in one checkpoint.
- Removed tracked browser profile/cache artifacts from the current tree.
- Added ignore rules for local build output, extracted game data, logs, database backups, and temporary runtime folders.

## 1.3.9 Beta - 2026-04-09

- Published GitHub release `v1.3.9` with Windows installer asset.
