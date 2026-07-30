# Security Policy

## Supported versions

GitBox is maintained by one person, and security fixes go into the next release
from `main`. Only the [latest release](https://github.com/gitgusilva/gitbox/releases/latest)
is supported: there are no backport branches for older versions. Before
reporting, please check that the problem still reproduces on the latest build.

The AppImage and the Windows installer update themselves from GitHub Releases.
The `.deb`, `.rpm` and `.pacman` packages are updated by your package manager,
so a fix reaches you only when you upgrade the package.

## Reporting a vulnerability

Do not open a public issue for a security problem.

Report it privately through GitHub Security Advisories:

**https://github.com/gitgusilva/gitbox/security/advisories/new**

That form is private between you and the maintainer, and it lets the fix be
prepared before anything becomes public. If you cannot use it, report the
repository to GitHub at https://github.com/contact/report-abuse and ask to be
put in touch.

Useful things to include:

- GitBox version, operating system, and which package you installed
  (AppImage, deb, rpm, pacman, exe, msi, or a build from source)
- What an attacker gains, and what they need in order to reach it: a crafted
  repository, a hostile remote, a malicious theme, a link inside a commit
  message, local access to the machine
- Steps to reproduce, and a proof of concept if you have one
- Relevant lines from `gitbox-main.log` (see below), with anything sensitive
  removed

Expect an acknowledgement within seven days. Fixes ship in the next release,
and, if you want the credit, your name goes in the CHANGELOG entry. Please keep
the report private until a fixed release is out.

## Areas worth attention

GitBox is an Electron application that runs Git operations natively, so the
parts most worth looking at are:

- **The main process and its IPC surface** (`ui/electron/src/handlers/`). Every
  renderer-to-main channel takes input that a repository, a remote, or a theme
  can influence.
- **The `gitbox://` deep link handler** (`ui/electron/src/protocol.js`), which
  parses URLs that other applications can hand to GitBox.
- **The native addon** (`core/addon/src/addon.cc`), a C++ binding over libgit2.
  Memory-safety problems reachable from a crafted repository belong here.
- **Credential storage** (`ui/electron/src/credentialStore.js`), which keeps
  host credentials in an encrypted store outside the settings file.
- **The Content-Security-Policy** applied to packaged builds in
  `ui/electron/src/main.js`, and the external link guards in
  `ui/electron/src/externalLinks.js`, which keep untrusted links and markup from
  navigating or scripting the app window.
- **The updater** (`ui/electron/src/updater.js`), which downloads and installs
  releases.
- **Themes from the registry**, which are fetched from a separate repository and
  rendered inside the app.

## Bundled dependencies

GitBox does not use the system Git. It links libgit2 statically, together with
mbedTLS, libssh2 and OpenSSL, all built from
`core/addon/vendor/build-libgit2.sh`. A vulnerability in any of them ships
inside GitBox until a release rebuilds against a fixed version, so it is worth
reporting even though the bug is not ours. The versions in use are pinned at the
top of that script, and the full dependency list is in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Out of scope

- Vulnerabilities in your Git host (GitHub, GitLab, Gitea) rather than in GitBox
- Attacks that need an already-compromised machine or an account you control on
  it, where the attacker could read the same data without GitBox
- Reports produced only by a scanner, with no explanation of what an attacker
  actually gains
- Missing hardening that has no demonstrated impact

## Where the logs are

The log file named in a report lives at:

- Linux: `~/.config/GitBox/logs/gitbox-main.log`
- Windows: `%APPDATA%\GitBox\logs\gitbox-main.log`
- Running from source: `logs/gitbox-main.log` in the repository

It records IPC calls and their timings. Check it for repository paths or remote
URLs you would rather not share before attaching it.
