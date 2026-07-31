# Changelog
All notable changes to this project will be documented in this file.

## v1.3.0
### Added
- Pull requests can be reviewed without leaving GitBox: the changed files are listed with their per-file counts, and clicking one opens the diff in a panel docked beside the conversation, with keyboard and button navigation between files. Image files open in the image viewer like any other diff
- The diff panel can be popped out into its own window, the way the merge editor already opens standalone, and docked back from either side. It follows the app theme, including changes made while it is open
- Reactions on a pull request and on its comments — add, remove, and see who reacted. The names cost a request each, so they are fetched when you hover a reaction rather than upfront for every comment
- Pull request summary: files changed, added and removed lines, commits, whether it can be merged, and when it was created and last updated
- Branch names in a pull request header link to the branch on GitHub or GitLab, pointing at the fork for a fork's pull request
- Screenshots in a pull request description or comment open full size on click, with fit and 1:1 zoom

### Changed
- Image diffs fit the pane instead of rendering at natural size: a 1440x920 screenshot used to show a cropped corner of itself with scrollbars for the rest. Zoom steps, fit and 1:1 are there for pixel-level inspection, each side reports its dimensions and weight, and the transparency grid follows the theme instead of being a fixed dark grey
- Blame is no longer offered for images — there are no lines to attribute
- The merge editor and the detached diff viewer name themselves before the file in their title bar, so they can be told apart from the main window in the task switcher
- Windows raise themselves when they open, opening a file brings the detached viewer forward, and reopening a file already open in the merge editor raises that window instead of opening a second one on the same conflict
- Opening a link hands focus to the browser, which used to open the page behind GitBox

### Fixed
- The pull request list went stale: the first list of a session was the only one, so a pull request merged or closed on the web stayed in the sidebar until the repository was switched. Toggling "show closed pull requests" also did nothing, for the same reason
- Switching repositories with a pull request open left the view showing the previous repository's pull request, while everything it asked for after that hit the new one
- A merged pull request was drawn as merely closed, and still offered to be approved and closed
- Approve and Request changes were unreadable on themes with light diff colours — the buttons filled from the theme but wrote in a fixed white. The foreground is now derived from the fill, and only turns dark where white would fail
- The minimize, maximize and close buttons acted on whichever window had focus rather than the one they belong to, so with the merge editor or the diff viewer open a click could hit a different window
- The pull request icon in the sidebar used a fixed purple that ignored the active theme

## v1.2.0
### Added
- Statistics gained filters: pick the contributors to chart, narrow to a time range, keep the top N, sort either way, and reset the zoom — so a busy repository's charts can be read one question at a time
- Dialogs can be dragged by their header and are kept fully inside the window, so a dialog no longer has to be closed to read what is behind it
- `Esc` closes the dialog on top. It works with a field inside the dialog focused, closes only the topmost when several are open, and gives way to an open context menu

### Changed
- The commit graph routes its lanes the way a Git client should: lanes compact as branches end instead of leaving gaps, and merges join with curves rather than the right angles that stacked several lines on one row
- Every surface now draws from the theme's design tokens instead of hardcoded colours, so light and custom themes no longer leak dark greys into panels, menus and dialogs
- The dialog backdrop is denser and blurs what is behind it, over the full window height — the project colour strip and the window controls stay clear of it
- GitBox now ships a single built-in theme, GitBox Dark. The bundled presets — Dracula, One Dark Pro, Nord, Monokai, Solarized Light and GitBox Light — moved to the [gitbox-themes](https://github.com/gitgusilva/gitbox-themes) registry, where every theme already existed as a copy. Install them from Settings › Appearance: they arrive with a preview image and their author's credit, and can be edited or deleted like any other theme, which the bundled copies could not be. New themes now land by adding a folder to that repository instead of waiting for a GitBox release
- If one of those presets was your active theme, the app falls back to GitBox Dark on first launch after updating. Reinstall it from the gallery to get it back — including the colours, if you had edited a forked copy, which is kept as a custom theme and is unaffected

### Fixed
- Links inside commit messages, pull requests and release notes open in your browser instead of navigating the app window away from GitBox, with the guard installed before any window exists so none can slip past it
- The merge glyph and the graph lanes of installed themes: the registry's copies still carried the light marker from before the cut-out fix, drawing the glyph as a pale blob under every theme but the two Solarized ones
- Dialogs no longer promote themselves to a GPU layer while sitting still, which is the pairing with the backdrop blur that Chromium composites least reliably
- The toolbar disconnected neither its resize observer nor its pending timers when torn down, and one of them dereferenced the tab strip after it was gone

## v1.1.7
### Fixed
- GitBox failed to start on Linux with `undefined symbol: EVP_des_ede3_cbc`, reported on Ubuntu 24.04 and affecting v1.1.4 through v1.1.6. The native addon never linked the vendored static OpenSSL that libssh2 needs, so it borrowed those symbols from whatever the host had already loaded — and Electron ships BoringSSL, which does not provide them ([#1](https://github.com/gitgusilva/gitbox/issues/1))

### Improved
- The addon's build is audited for self-containment before packaging: the test suite checks the imported symbols of the built binary instead of only loading it, because on a machine with a system libcrypto the broken binary loads fine
- Linux and Windows builds run on every pull request, so a packaging break is caught before a tag publishes it

## v1.1.6
### Added
- "Open in external terminal" and "Open in file manager" now work from the main menu, with the `Alt+T` / `Alt+O` shortcuts it already advertised. The terminal is the one picked in Settings, falling back to whichever is installed
- Git settings show the Gravatar photo linked to your git email — the same one the history uses — with a link to manage it on Gravatar
- Tooltips on the sidebar's filter toggle and on the ahead/behind counters, which now say how many commits there are to pull and to push

### Fixed
- The commit graph follows the active theme: every built-in theme has its own lane palette instead of all of them sharing one, and editing a graph colour in the Appearance editor recolours the graph without a reload
- Off-branch commits, the dot outline and the merge glyph no longer use hardcoded greys and whites that clashed with light and custom themes
- The title bar stays usable while a dialog is open — the backdrop covered the drag region and the minimize/maximize/close buttons, leaving the window impossible to move or close
- The AI commit analysis keeps its section headings in the selected language instead of returning English titles over translated text
- Switching to a blank tab no longer leaves the previous repository loaded, where the menu and sync actions acted on a repository the tab wasn't showing
- Settings return to the top of the page when you switch sections, instead of keeping the previous section's scroll position
- The sidebar and the history filter bar use the same filter icon
- The keyboard shortcuts sheet scrolls: the list ran past the dialog and the rest was unreachable

## v1.1.5
### Fixed
- A repository that was moved, renamed or deleted no longer leaves a raw `could not find repository at '…'` error on screen: the tab is closed, the stale branches, history and graph are cleared and the entry is dropped from the recent list
- Opening a folder that is not a Git repository says so, instead of opening it and showing the previous repository's data
- Terminals no longer lose their scrollback when the window is minimized, the panel is hidden or you switch between sessions
- Terminal output is no longer lost while another window (the merge editor) is in front
- Maximizing the terminal panel now fills the whole content area, like the Command Log
- History columns: the Author/Time dividers follow the cursor, can't be dragged past the list, and shrink with it instead of pushing the date column out of view
- Panel and column sizes are remembered across restarts

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
