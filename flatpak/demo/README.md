# Demo recording

Flathub's submission checklist asks for a video of the application running on
Linux *as the Flatpak*. This records one:

```sh
./record.sh [output.mp4]        # default: ~/gitbox-flatpak-demo.mp4
```

It needs the Flatpak already installed (`../README.md` covers building it),
plus `node`, `ffmpeg` with `libopenh264`, `git` and `python3`.

## What it does

1. Clones `gitbox-themes` into `~/gitbox-demo` and stages the situation the
   tour needs: a branch whose change collides with an uncommitted one on `main`,
   so the merge later in the video produces a real conflict.
2. Moves your GitBox settings aside, so the recording starts from a clean
   first-run app, and puts them back when it exits — including on failure.
3. Starts the Flatpak with `--remote-debugging-port`, opens the repository, and
   plays `storyboard.mjs`: the graph, a commit's detail tabs, the projects and
   branch menus, creating a branch, a diff, staging, a commit, a fetch, a
   conflicting merge with the merge editor, the command log, the statistics
   view, and settings including a theme installed from the registry.
4. Writes an mp4 of the app's window.

## What ends up in the frame

`Page.startScreencast` captures the page's own compositor surface, so the video
contains the application and nothing else: no other windows, no desktop, no
cursor, and no audio. Windows GitBox opens for itself — the merge editor, the
detached diff viewer — are separate pages, and the storyboard says which one is
on camera with `focusWindow()` / `focusMain()`.

Frames arrive only when the screen changes, each with a timestamp, and are
re-timed on the way out. A view that sits still for four seconds costs one
frame, which is why a two-minute tour lands around 2 MB.

**Addresses are blurred in the page, not over the video.** The git identity in
Settings, the author of every commit in the detail panel and the Gravatar
fetched for it are found by a sweep running every 80 ms and blurred before they
are drawn, so no frame can leak one. The demo commit is authored as
`GitBox Demo <demo@example.invalid>`; override with `DEMO_NAME` / `DEMO_EMAIL`.

## Adjusting it

`storyboard.mjs` is the shot list — beats wrapped in `step()`, so a target that
moved costs its own moment and not the recording. Targets are found in the DOM
by their text; **do not go back to fixed coordinates**, because the window is
whatever size the compositor gives it. An earlier version aimed at pixels and
clicked "Discard ALL changes" instead of "Create branch".

`driver.mjs` owns the capture and the encoding. Useful knobs, all environment
variables: `OUT_FILE`, `CANVAS_W` (default 1280), `FPS` (24), `BITRATE`
(2600k), `CDP_PORT` (9222).
