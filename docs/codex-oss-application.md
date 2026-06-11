# Codex OSS Application Draft

Last updated: 2026-06-12.

Source criteria: https://openai.com/form/codex-for-oss/

## Official Form Fields

- First name / last name: maintainer details.
- Email: the email associated with the maintainer's ChatGPT account.
- GitHub username: use a public profile.
- GitHub repository URL: use a public repository URL.
- Maintainer role: Primary maintainer.
- Interest: API credits for my project and Codex Security.
- OpenAI Organization ID: copy from the OpenAI platform organization settings.

## Form-Ready Answers

### Why does this repository qualify? (455/500 chars)

Varo is a public MIT desktop tool for AI-assisted game localization. It maintains scan/extract/translate/apply/rollback paths across RPG Maker, Wolf RPG, Unity, Unreal, DXLib, MuMu, plus manga OCR and subtitles. It is niche but maintenance-heavy: every engine needs compatibility triage, release checks, and security review. Current signals: v1.4.3 release, 73-member Discord, 3 GitHub stars, 100+ maintainer-reported direct downloads pending log backing.

### How will you use API credits for your project? (347/500 chars)

I would use API credits for maintainer automation: issue triage and duplicate clustering, PR review, parser/apply regression-test generation, Electron/FastAPI security review, release checklist automation, and release-note drafting. The goal is to reduce maintenance load while keeping Varo's local-first behavior and release safety checks honest.

### Anything else we should know? (384/500 chars)

I am interested in both API credits and Codex Security. The highest-risk areas are Electron main/preload boundaries, local FastAPI file routes, API-key storage, update/download behavior, local database handling, and apply/rollback paths. Repository history was rewritten to remove old browser-profile/cache artifacts; GitHub Support cleanup is requested for the affected PR ref/cache.

## Pre-Submit Gate

- Submit the GitHub Support request in `docs/github-support-sensitive-data-request.md`, then record the support outcome or disclose that hidden PR-ref/cache cleanup is pending.
- Back the 100+ direct/private download claim with server logs if available. If logs are not available, keep the wording as maintainer-reported.
- Verify the GitHub profile and repository are public.
- Have the OpenAI Organization ID ready before opening the form.

## Repository

https://github.com/rag91560-spec/varo

## Maintainer Role

I am the maintainer and release owner for Varo. I triage user reports, review code changes, manage Electron/FastAPI releases, maintain engine compatibility work, and decide what ships. AI tools may assist, but I remain responsible for all accepted changes.

## Why This Repository Fits

Varo is a public MIT desktop tool for AI-assisted game localization. It handles scan, extraction, translation, apply, rollback, manga OCR, and subtitle workflows. The niche is small but maintenance-heavy because each game engine needs separate compatibility and regression work.

## Product Usage / Impact

As of 2026-06-12, Varo is public with 3 GitHub stars, a current v1.4.3 GitHub release, 4 observed legacy GitHub-release downloads, a maintainer-reported 100+ direct/private downloads, and a 73-member Discord support community. Direct/private downloads should be backed by server logs before final submission.

## API Credit Usage

We would use API credits for real maintainer workflows: issue triage, duplicate report clustering, PR review, parser/apply regression-test generation, Electron/backend security review, release checklist automation, and release-note drafting.

## Codex Security Interest

Codex Security would help review Electron preload/main boundaries, local FastAPI routes, update/download behavior, local database handling, API-key storage, and file-system apply/rollback paths before releases.

## Additional Context

The v1.4.3 GitHub release is published, and `package.json` is now on a v1.4.4 release-candidate line. Public branch/tag history has been rewritten to remove old browser-profile/cache artifacts. GitHub Support cleanup is still requested for the affected hidden PR ref and cached views.
