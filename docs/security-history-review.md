# Security History Review

Last updated: 2026-06-12.

## Summary

The repository history was rewritten on 2026-06-12 with `git-filter-repo --sensitive-data-removal` after maintainer approval. The public `master` branch and release tags no longer contain the previously tracked browser profile/cache artifacts or generated build artifacts listed below.

GitHub rejected direct updates to `refs/pull/1/head`, which is a hidden pull-request ref. GitHub Support still needs to remove cached views / pull-request refs and run repository garbage collection before this incident can be treated as fully closed on GitHub infrastructure.

## Current Tree Scan

Command:

```powershell
git grep -I -n -E "(sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|DISCORD_TOKEN|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|xox[baprs]-[A-Za-z0-9-]+)" HEAD -- . ':!marketing/profiles' ':!package-lock.json'
```

Result:

- No literal API keys or tokens were found.
- Environment-variable references were found for provider and Discord tokens; those are expected code references, not secrets.

## History Rewrite

Removed path families:

- `marketing/profiles/**`
- `data/covers/**`
- `LICENSE.txt.bak`
- `tsconfig.tsbuildinfo`

Rewrite evidence:

- Tool: `git-filter-repo` 2.47.0
- Commits rewritten: 45 of 45
- First changed commit: `be5bf5d83c49713ff134d66992c6498e8298fba6`
- Rewritten commit: `cdf24790fa2e49e75ff095425d1f0561a7900d8b`
- LFS: not in use

Verification after rewrite:

- `git rev-list --objects --all | rg ' (marketing/profiles|data/covers|LICENSE\.txt\.bak|tsconfig\.tsbuildinfo)' | wc -l` returned `0`.
- Representative high-confidence token pattern search found no matches for OpenAI, GitHub, or Slack-style token formats.
- `git fsck --unreachable --no-reflogs` returned no output after local reflog expiry and garbage collection.
- Public remote refs after cleanup: `master`, `v1.3.9`, and `v1.4.3`.

## Remaining GitHub Support Step

Open a GitHub Support ticket requesting removal of the affected hidden pull-request ref / cached views and repository garbage collection. Use `docs/github-support-sensitive-data-request.md` as the support-ticket source text.

Do not merge or push from old clones. Existing clones should be discarded and re-cloned, or cleaned with the official sensitive-data-removal procedure.

## Standing Rule

Never commit browser profiles, cookies, local/session storage, login databases, database backups, extracted game content, logs, or private keys.
