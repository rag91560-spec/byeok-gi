# Security Policy

## Supported Surface

Security reports should focus on the public repository and packaged Varo behavior:

- Electron main/preload boundaries
- local FastAPI backend routes
- file-system access and path handling
- update/download behavior
- local library database handling
- API key storage and provider configuration
- translation apply/rollback safety

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities that include secrets, exploit details, private logs, or user data.

Report privately through the maintainer's Discord contact path linked in the README, or open a minimal GitHub issue that asks for a private follow-up without including sensitive details.

Include:

- affected version
- affected platform
- reproduction steps
- expected vs actual behavior
- whether credentials, local files, or update delivery are involved
- any temporary mitigation you already found

## Data Handling Expectations

Varo is local-first. Game files remain on the user's machine unless the user explicitly configures an external AI provider. Reports should remove:

- API keys and tokens
- cookies and browser profile data
- local account databases
- private game files
- database backups
- full absolute paths when they reveal private user information

## Maintainer Response

The maintainer will triage security reports as soon as possible, prioritize issues that expose credentials or enable unintended file access, and document the fix or mitigation in release notes when appropriate.
