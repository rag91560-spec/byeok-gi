# GitHub Support Sensitive Data Removal Request

Last updated: 2026-06-12.

Use this as the source text for a GitHub Support ticket after the local history rewrite and force push.

```text
Repository: rag91560-spec/varo

I rewrote repository history with git-filter-repo --sensitive-data-removal and force-pushed the rewritten branch/tag refs.

Removed paths:
- marketing/profiles/**
- data/covers/**
- LICENSE.txt.bak
- tsconfig.tsbuildinfo

Affected pull requests: 1
Affected PR ref: refs/pull/1/head

First Changed Commit(s):
be5bf5d83c49713ff134d66992c6498e8298fba6 -> cdf24790fa2e49e75ff095425d1f0561a7900d8b

LFS object orphaning: not checked because LFS is not in use.

Please dereference/delete affected PR refs, remove cached views for the sensitive data, and run repository garbage collection.
```

## Local Verification Evidence

- Public branch/tag refs were rewritten and pushed.
- GitHub rejected direct updates to `refs/pull/1/head` because it is a hidden ref.
- `git rev-list --objects --all | rg ' (marketing/profiles|data/covers|LICENSE\.txt\.bak|tsconfig\.tsbuildinfo)' | wc -l` returned `0` after local cleanup.
- Representative high-confidence token pattern search returned no matches.
- `git fsck --unreachable --no-reflogs` returned no output after local reflog expiry and garbage collection.
