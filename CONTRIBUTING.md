# Contributing to Varo

Thanks for helping improve Varo. The most useful contributions are focused, reproducible, and tied to a real game/workflow failure.

## Good First Contributions

- documentation fixes
- compatibility reports for supported engines
- small UI or localization fixes
- parser/apply regression tests
- release-process improvements
- issue triage and reproduction notes

## Before Opening an Issue

Search existing issues first. If the report is about a game, include:

- Varo version
- Windows version
- game engine if known
- whether the game is RPG Maker, Unity, Unreal, Wolf RPG, DXLib, MuMu, or another engine
- what step failed: scan, translate, apply, rollback, launch, OCR, subtitles, update
- logs or screenshots with private paths/tokens removed

Do not upload copyrighted game files, paid game content, private API keys, cookies, browser profiles, or database backups.

## Pull Requests

Keep pull requests narrow. A good PR usually:

- changes one subsystem or doc surface
- explains the user-visible problem
- includes the smallest useful test or verification step
- avoids unrelated formatting churn
- does not add generated output

Run what applies:

```bash
npm run lint
npm run build
```

Backend-only changes should at least compile the touched Python files:

```bash
python -m py_compile backend/server.py
```

## AI-Assisted Contributions

AI tools are allowed, but the human contributor is responsible for reviewing the patch. Do not submit generated code you cannot explain or maintain.

## Security and Privacy

Use [SECURITY.md](SECURITY.md) for vulnerabilities or privacy-sensitive reports. Never open a public issue containing secrets, cookies, login databases, or private game/account data.
