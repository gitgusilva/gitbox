const { createChildWindow } = require('./child');

// One detached diff window at a time: it mirrors a single docked panel, so a
// second one would just be a stale copy of the same view.
let diffWindow = null;

/**
 * Creates (or focuses) the standalone diff viewer — the docked panel "popped
 * out" into its own window, in the renderer's "diff" mode. It holds no state
 * of its own: the window that detached it pushes the file and its contents in,
 * and navigation requests travel back the same way.
 *
 * @returns {BrowserWindow}
 */
function createDiffWindow() {
    if (diffWindow && !diffWindow.isDestroyed()) {
        diffWindow.focus();
        return diffWindow;
    }

    diffWindow = createChildWindow({
        mode: 'diff',
        title: 'GitBox — Diff Viewer',
        width: 1200,
        height: 800,
    });

    diffWindow.on('closed', () => {
        diffWindow = null;
    });

    return diffWindow;
}

function getDiffWindow() {
    return diffWindow && !diffWindow.isDestroyed() ? diffWindow : null;
}

/** Raise the detached viewer so a file opened from the main window is seen. */
function focusDiffWindow() {
    const win = getDiffWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
}

function closeDiffWindow() {
    const win = getDiffWindow();
    if (win) win.close();
}

module.exports = { createDiffWindow, getDiffWindow, focusDiffWindow, closeDiffWindow };
