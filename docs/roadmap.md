# Roadmap

This roadmap prioritizes maintenance quality over broad feature growth.

## Near Term

- Complete public repository hygiene for Codex OSS application readiness.
- Resolve the public-history decision for previously tracked browser profile artifacts.
- Keep README, legal, security, and contribution docs accurate.
- Add regression coverage for high-risk apply/rollback paths.
- Improve issue templates so game compatibility reports arrive with enough context.

## Engine Reliability

- Expand real-game verification for beta engines.
- Add small fixture-based parser tests where copyright-safe fixtures are possible.
- Track known limitations per engine.
- Improve rollback failure reporting.

## Release Quality

- Keep `npm run lint` and `npm run build` green.
- Keep `scripts/verify-build-inputs.js` in the Electron packaging chain.
- Document every release with a short changelog entry.
- Avoid shipping incomplete packages when local proprietary build inputs are missing.

## Community and Support

- Convert repeated Discord reports into GitHub issues when they are reproducible.
- Maintain a compatibility-report workflow for users who cannot share game files.
- Keep support boundaries clear: no copyrighted game uploads, no API keys, no cookies, no browser profiles.

## AI-Assisted Maintenance

Codex/API credits would be most useful for:

- issue triage and duplicate detection
- PR review against engine-specific failure modes
- regression-test generation for parsers and apply paths
- security review of Electron/backend changes
- release-note drafting and checklist automation
