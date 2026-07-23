# Changelog
All notable changes to this project will be documented in this file.

## v1.1.4
### Added
- Remote authentication: GitBox saves per-host credentials in an encrypted store and reuses them for fetch, pull and push over HTTPS and SSH, so you sign in once. Manage them from Settings › Credentials
- Theme gallery now works offline — preview images are cached on disk — and themes can be favorited to pin them to the top of the list

### Fixed
- Focus outlines no longer paint the system accent colour over inputs, menus and dialogs

## v1.1.3
### Added
- Release notes are shown once after updating to a new version, and can be reopened from Settings › Updates

### Fixed
- A pull blocked by local changes named the files it would overwrite, and offers to stash them, pull and restore
- Discarding a file no longer depends on a system `git` — it runs through libgit2, and handles staged-new files correctly
- Permission failures name the file and the folder that need their ownership fixed, with the exact command to copy
- Error messages no longer carry the internal `Error invoking remote method '…'` prefix that pushed the real cause out of view
- Restoring a stash keeps the entry when the changes conflict, instead of dropping it over a half-merged working tree
- Restoring a stash brings the changes back unstaged, matching `git stash pop`

## v1.1.2
### Fixed
- Discarding an untracked file logged two "pathspec did not match" errors for an operation that had succeeded
- Repositories without a remote no longer error: the sync actions are disabled with an explanation, and the background fetch is skipped
- Stashing selected files could half-succeed — the stash was created and the operation still reported failure — when a path had gone stale since the list was rendered
- Stage, unstage, stash and discard now drop paths git no longer reports instead of failing on them
- A pull that diverged from upstream is logged as the action it is (it opens the merge/rebase dialog), not as a failure
- Merge conflicts are reported as the expected outcome of a merge rather than an error

## v1.1.1
### Fixed
- Merge editor: the two sides of a conflict were swapped — the local side was labelled "Incoming" and the branch being merged in was labelled "Current"
- Merge editor: "accept all incoming" wrote the local side into the file (and "accept all current" wrote the remote one); "keep both" also emitted the sides in the wrong order

## v1.1.0
### Added
- Projects: group repositories into colour-coded projects, each with its own set of tabs
- Project switcher in the toolbar, with search once the list grows past 8 projects
- Keyboard shortcuts for projects: Ctrl+Shift+P (menu), Alt+PageUp/PageDown (cycle), Alt+1..9 (jump)
- Command Log: expanded entries now say when a command produced no output

### Improved
- Keyboard shortcuts sheet: grouped by category, two columns, searchable and fully translated
- Project and repository colours share the same palette; new repos inherit their project's colour
- Modals, menus and the new UI follow the active theme's design tokens

### Fixed
- Command Log list did not render at all, and never scrolled with large entries
- Command Log showed every git command twice (two listeners on the same IPC event)
- Command Log reopened on the "Error" tab instead of the last one used
- Branches included in the history filter were dimmed in the graph as if unfiltered
- The "hide icon labels" setting had no effect on toolbar actions

## v0.1.0
### Added
- Initial release of GitBox
- Integrated AI powered commit message generation
- Advanced diff viewer with side-by-side and inline modes
- High-performance history view with virtual scrolling
- Integrated terminal for advanced Git operations
- Beautiful dark mode UI with glassmorphism effects
- Support for multiple repositories and branch management

### Improved
- Optimized repository loading speed
- Refined UI layout for better accessibility
- Improved search functionality in commit history
