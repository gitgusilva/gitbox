# Flatpak / Flathub

Everything needed to publish GitBox on [Flathub](https://flathub.org), the
cross-desktop Flatpak store (GNOME Software, KDE Discover, Cosmic Store, Steam
Deck — not a GNOME-only channel).

| File | Purpose |
| --- | --- |
| `io.github.gitgusilva.gitbox.yml` | The manifest Flathub builds from |
| `io.github.gitgusilva.gitbox.metainfo.xml` | AppStream data: name, screenshots, releases |
| `io.github.gitgusilva.gitbox.desktop` | Desktop entry installed inside the sandbox |
| `gitbox.sh` | Launcher; runs the Electron binary under `zypak-wrapper` |
| `flathub.json` | Flathub build config: x86_64 only, auto-merge bot PRs |

## Why the app id is not `com.gitbox.app`

Flathub only accepts an id under a domain or code-hosting account you control.
`gitbox.com` is not ours, so the Flatpak is published as
**`io.github.gitgusilva.gitbox`**, derived from `github.com/gitgusilva`. The
deb/rpm/pacman/Windows packages keep `com.gitbox.app`; the two ids never meet.

## Why it repackages the .deb instead of building from source

`build-linux.yml` already compiles everything — the Vue UI, the native addon,
and the statically linked libgit2/mbedTLS/OpenSSL/libssh2 — and publishes
`GitBox-<version>-amd64.deb` to the GitHub Release. The manifest downloads that
asset (pinned by sha256) and installs `/opt/GitBox` into `/app/gitbox`.

Building from source inside `flatpak-builder` would mean vendoring three npm
dependency trees plus every tarball `core/addon/vendor/build-libgit2.sh`
fetches, all resolvable offline, to end up with a byte-identical binary. This is
the accepted pattern for Electron apps on Flathub.

## Building and testing locally

```sh
flatpak install --user flathub org.flatpak.Builder
cd flatpak
flatpak run org.flatpak.Builder --force-clean --user --install-deps-from=flathub \
  --repo="$HOME/.cache/gitbox-flatpak-repo" --install builddir \
  io.github.gitgusilva.gitbox.yml

flatpak run io.github.gitgusilva.gitbox
```

Linting, the same way Flathub does it:

```sh
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest io.github.gitgusilva.gitbox.yml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder builddir builddir
```

Three findings are expected and are **not** defects:

- `appstream-external-screenshot-url` — screenshots are served from the project
  site until Flathub mirrors them to `dl.flathub.org` after acceptance.
- `finish-args-home-filesystem-access` and `finish-args-has-socket-ssh-auth` —
  both need a reviewer-granted exception. Justify them in the submission PR:

  > GitBox is a Git client. `--filesystem=home` is what lets it open working
  > trees wherever the user keeps them and read `~/.gitconfig` and `~/.ssh`;
  > `--filesystem=host` was deliberately avoided. `--socket=ssh-auth` is what
  > makes `git` over SSH work — the bundled libssh2 authenticates through the
  > user's SSH agent.

## Submitting (one time, manual)

Flathub reviews new apps by hand; there is no API for this step.

1. Fork <https://github.com/flathub/flathub>.
2. Create a branch **off `new-pr`** (not `master`) named after the app id:
   ```sh
   git clone https://github.com/<you>/flathub.git && cd flathub
   git checkout -b io.github.gitgusilva.gitbox origin/new-pr
   ```
3. Copy the manifest, metainfo, desktop file, `gitbox.sh` and `flathub.json`
   into the repository root, commit, push.
4. Open a PR against the **`new-pr`** branch, and in the description include the
   permission justification above.
5. A build runs on Flathub's infra; a reviewer comments. Expect a round or two
   of feedback.

On acceptance Flathub creates `flathub/io.github.gitgusilva.gitbox`, gives you
push access, and **that repository becomes the source of truth**. The copy in
this directory stays for local testing and CI validation.

## Publishing updates (automatic)

Nothing to do per release. The `.deb` source in the manifest carries
`x-checker-data`, so Flathub's external-data-checker polls
`api.github.com/repos/gitgusilva/gitbox/releases/latest`, resolves the new
`GitBox-<version>-amd64.deb`, refreshes the URL and sha256, and opens a PR on
the flathub repo. `"automerge-flathubbot-prs": true` in `flathub.json` merges
and publishes it without human input.

Two things keep that working, both already true of `build-linux.yml`:

- release tags stay `v<version>` and asset names stay `GitBox-<version>-amd64.deb`
- the release is a real GitHub Release (not a draft), so `/releases/latest` sees it

Add a `<release>` entry to `io.github.gitgusilva.gitbox.metainfo.xml` when
cutting a version — that is what shows as release notes in the software centres.
The bot does not write it.

If you ever want the update to land the moment the tag build finishes rather
than on the bot's next poll, add a job to `build-linux.yml` that checks out
`flathub/io.github.gitgusilva.gitbox` with a PAT, rewrites the `url`/`sha256`,
and pushes. It buys a few hours and costs a credential to rotate; the bot is the
better default.

## Known sandbox limitations

- **External editors and diff tools.** `ui/electron/src/handlers/system.js`
  probes the host `PATH` for VS Code, Meld, KDiff3, terminal emulators, etc.
  Inside the sandbox those binaries are not visible, so the pickers come up
  empty and "open in editor" does nothing. Fixing it means routing those spawns
  through `flatpak-spawn --host` and adding `--talk-name=org.freedesktop.Flatpak`
  to `finish-args` — full host access, which Flathub flags on the app page.
- **Integrated terminal.** Works, but the shell is the runtime's `/bin/bash`
  inside the sandbox, not the user's login shell — no host toolchains on `PATH`.
- **Self-update.** Correctly reports "unsupported": `updater.js` only self-updates
  the AppImage on Linux, and Flathub handles updates itself.
