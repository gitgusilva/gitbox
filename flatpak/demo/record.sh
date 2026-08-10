#!/usr/bin/env bash
# Records the demo video the Flathub submission asks for.
#
#   ./flatpak/demo/record.sh [output.mp4]
#
# It builds a throwaway repository under ~/gitbox-demo, starts the installed
# Flatpak with the DevTools port open, drives the UI, and writes an mp4 of the
# app's own window — no desktop, no cursor, no audio. Your GitBox settings are
# moved aside for the run and put back afterwards, so the recording always
# starts from a clean, first-run app.
set -euo pipefail

APP_ID=io.github.gitgusilva.gitbox
PORT=${CDP_PORT:-9222}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUT=${1:-$HOME/gitbox-flatpak-demo.mp4}
DEMO_DIR=$HOME/gitbox-demo
REPO=$DEMO_DIR/gitbox-themes
UPSTREAM=https://github.com/gitgusilva/gitbox-themes.git

# The identity the demo commit is authored with. It ends up on screen, so it is
# deliberately not whatever ~/.gitconfig says.
DEMO_NAME=${DEMO_NAME:-GitBox Demo}
DEMO_EMAIL=${DEMO_EMAIL:-demo@example.invalid}

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

for tool in flatpak node ffmpeg git curl; do
    command -v "$tool" >/dev/null || die "$tool is not installed"
done
# Not piped into grep: grep -q closes the pipe early, and under `pipefail` that
# failed ffmpeg is what the shell reports.
ENCODERS=$(ffmpeg -hide_banner -encoders 2>/dev/null || true)
case "$ENCODERS" in
    *libopenh264*) ;;
    *) die "this ffmpeg has no libopenh264 encoder; install ffmpeg-free or ffmpeg" ;;
esac
flatpak info "$APP_ID" >/dev/null 2>&1 \
    || die "$APP_ID is not installed — build it first (see ../README.md)"

say "1/6  Building the demo repository"
rm -rf "$REPO"
mkdir -p "$DEMO_DIR"
git clone --quiet "$UPSTREAM" "$REPO"
git -C "$REPO" config user.name "$DEMO_NAME"
git -C "$REPO" config user.email "$DEMO_EMAIL"

BASE=$(git -C "$REPO" rev-parse HEAD)
tweak() {  # tweak <version> <description suffix> <hover colour>
    python3 - "$REPO" "$1" "$2" "$3" <<'PY'
import pathlib, sys
repo, version, suffix, hover = sys.argv[1:5]
p = pathlib.Path(repo, 'themes/nord/theme.json')
s = p.read_text()
s = s.replace('"version": "1.0.1"', f'"version": "{version}"')
s = s.replace('"description": "An arctic, north-bluish color palette."',
              f'"description": "An arctic, north-bluish color palette{suffix}."')
s = s.replace('"surfaceHover": "#4C566A"', f'"surfaceHover": "{hover}"')
p.write_text(s)
PY
}

# A branch that touches the same lines, so merging it later really conflicts.
git -C "$REPO" checkout --quiet -b feat/nord-tuning "$BASE"
tweak 1.0.2 " with a warmer surface" "#525E78"
git -C "$REPO" commit --quiet -am "feat(themes): raise the Nord hover contrast"

# …and an uncommitted change on main, for the diff and the commit on camera.
git -C "$REPO" checkout --quiet main
tweak 1.1.0 ", tuned for long sessions" "#48536B"

say "2/6  Starting GitBox with a clean profile"
flatpak kill "$APP_ID" 2>/dev/null || true
sleep 2
CONFIG=$HOME/.var/app/$APP_ID/config
BACKUP=
if [ -d "$CONFIG" ]; then
    BACKUP=$CONFIG.before-demo.$$
    mv "$CONFIG" "$BACKUP"
fi
restore() {
    flatpak kill "$APP_ID" 2>/dev/null || true
    if [ -n "$BACKUP" ]; then
        rm -rf "$CONFIG"
        mv "$BACKUP" "$CONFIG"
        echo "  settings restored"
    fi
}
trap restore EXIT

# Chromium stops painting and stops acknowledging input for a window it thinks
# nobody can see. Leave that on and a window that ends up behind a terminal
# records six seconds of nothing while every click times out.
flatpak run "$APP_ID" \
    --remote-debugging-port="$PORT" \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-background-timer-throttling \
    >/tmp/gitbox-demo-app.log 2>&1 &
for _ in $(seq 1 30); do
    curl -sf "http://127.0.0.1:$PORT/json/list" >/dev/null && break
    sleep 1
done
curl -sf "http://127.0.0.1:$PORT/json/list" >/dev/null || die "GitBox never opened its debugging port"
sleep 3

say "3/6  Sizing the window and opening the repository"
CDP_PORT="$PORT" REPO_PATH="$REPO" node "$HERE/prepare.mjs"

say "4/6  Recording"
CDP_PORT="$PORT" OUT_FILE="$OUT" STORYBOARD="$HERE/storyboard.mjs" node "$HERE/driver.mjs"

say "5/6  Resetting the demo repository"
git -C "$REPO" merge --abort 2>/dev/null || true
git -C "$REPO" checkout --quiet main
git -C "$REPO" reset --quiet --hard "$BASE"

say "6/6  Done"
ls -lh "$OUT"
echo "  drop this file into the Flathub pull request to tick the video box"
