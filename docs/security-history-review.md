# Security History Review

Last updated: 2026-05-31.

## Summary

The current `HEAD` removes tracked browser profile/cache artifacts from the working tree and `.gitignore` now blocks them from returning. However, `origin/master` and repository history still contain browser-profile paths under `marketing/profiles`.

Do not push or submit the Codex OSS application as "fully clean" until the history decision below is resolved.

## Current Tree Scan

Command:

```powershell
git grep -I -n -E "(sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|DISCORD_TOKEN|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|xox[baprs]-[A-Za-z0-9-]+)" HEAD -- . ':!marketing/profiles' ':!package-lock.json'
```

Result:

- No literal API keys or tokens were found.
- Environment-variable references were found for provider and Discord tokens; those are expected code references, not secrets.

## Public History Risk

`origin/master` includes paths such as:

- `marketing/profiles/*/Default/Network/Cookies`
- `marketing/profiles/*/Default/Login Data`
- `marketing/profiles/*/Default/Local Storage`
- `marketing/profiles/*/Default/Session Storage`
- `marketing/profiles/*/Default/Secure Preferences`
- `marketing/profiles/*/Local State`

These are browser profile artifact paths. Even if the content is not inspected here, their presence is enough to treat the history as privacy-sensitive until reviewed.

## Decision Needed Before Push or Application

Choose one:

1. Push the current cleanup commit and disclose that current tree is clean, while accepting that old public history may still contain profile artifacts.
2. Rewrite public history to remove `marketing/profiles/**`, then force-push after maintainer approval.
3. Create a fresh public repository/import without the sensitive history, then point the application to the clean repo.

Recommended path: option 3 if the repo has low public dependency and preserving current history is not important; option 2 only if the maintainer explicitly accepts public-history rewrite risk.

## Standing Rule

Never commit browser profiles, cookies, local/session storage, login databases, database backups, extracted game content, logs, or private keys.
