// The tour, in the order the camera sees it.
//
// Nothing here clicks a bare coordinate. Every target is found in the DOM and
// clicked where it actually is, because the window is whatever size the user's
// compositor gives it — an earlier version of this file aimed at fixed pixels
// and opened "Discard ALL changes" instead of "Create branch".
//
// Every beat is wrapped in step(), so a target that has moved or vanished costs
// its own moment and not the recording.

const byText = (sel, text) =>
    `[...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.innerText.trim().startsWith(${JSON.stringify(text)}))`;

const btn = text => byText('button', text);

const leaf = text =>
    `[...document.querySelectorAll('div,span')].find(e => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(text)})`;

/** The clickable row that owns a piece of text (label → its container). */
const rowOf = text => `(() => {
    const label = ${leaf(text)};
    return label ? label.parentElement.parentElement : null;
})()`;

export default async function (ctx) {
    const { click, clickAt, rightClick, box, move, scroll, type, key, sleep, step, evaluate, focusWindow, focusMain, log } = ctx;

    // Click somewhere harmless to dismiss a menu: the header strip above the
    // commit list holds no controls.
    const dismiss = async () => {
        const anchor = await box(leaf('GRAPH & SUBJECT'));
        if (anchor) await clickAt(anchor.x, anchor.y);
        await sleep(700);
    };

    // ── The graph ────────────────────────────────────────────────────────
    await step('history', async () => {
        await click(btn('History'));
        await sleep(1800);
        const list = await box(`document.querySelector('[id^="commit-"]').parentElement`);
        const x = list ? list.x : 700;
        const y = list ? Math.min(list.y + 200, 600) : 500;
        for (let i = 0; i < 3; i++) { await scroll(x, y, 220); await sleep(450); }
        await sleep(700);
        for (let i = 0; i < 3; i++) { await scroll(x, y, -220); await sleep(400); }
        await sleep(600);
    });

    // A merge commit, so the detail panel has two parents to show — and because
    // those are the commits GitHub authored, whose address is the noreply one.
    // Picking any commit would put a contributor's real address on screen.
    await step('commit detail', async () => {
        await click(`[...document.querySelectorAll('[id^="commit-"]')].find(e => e.innerText.includes('Merge pull request'))`);
        await sleep(2400);
        for (const tab of ['CHANGES', 'FILES', 'INFORMATION']) {
            await click(leaf(tab));
            await sleep(1800);
        }
    });

    // ── Projects and branches ────────────────────────────────────────────
    await step('projects menu', async () => {
        await click(`document.querySelector('#project-switcher')`);
        await sleep(2000);
        await dismiss();
    });

    await step('branch menu', async () => {
        await click(rowOf('branch'));
        await sleep(2200);
        await key('Escape');
        await sleep(400);
        await dismiss();
    });

    await step('create branch', async () => {
        await click(btn('CREATE BRANCH'));
        await sleep(1400);
        await type('input[placeholder*="feature"]', 'feat/theme-polish', 55);
        await sleep(1400);
        await click(btn('CANCEL'));
        await sleep(900);
    });

    // ── The working tree: diff, stage, commit ────────────────────────────
    await step('diff and stage', async () => {
        await click(btn('Local Changes'));
        await sleep(2600);
        const row = await box(leaf('theme.json'));
        await clickAt(row.x, row.y);
        await sleep(1800);
        // Double-click is the app's own stage/unstage shortcut.
        await evaluate(`(() => {
            const el = document.elementFromPoint(${row.x}, ${row.y});
            el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: ${row.x}, clientY: ${row.y} }));
        })()`);
        await sleep(2000);
    });

    await step('commit', async () => {
        await click(`document.querySelector('input[placeholder^="Summary"]')`);
        await type('input[placeholder^="Summary"]', 'feat(themes): warm up the Nord hover surface', 36);
        await sleep(800);
        await click(btn('COMMIT'));
        await sleep(2200);
        await click(btn('History'));
        await sleep(2600);
    });

    // ── The network, through libgit2 rather than the CLI ─────────────────
    await step('fetch', async () => {
        await click(btn('FETCH'));
        await sleep(3200);
    });

    // ── Merging, and the conflict editor in its own window ───────────────
    await step('merge with conflict', async () => {
        // Branches group by prefix, so the group has to be opened first: the
        // row toggles, and the chevron on its left edge is the fallback.
        if (!await box(leaf('nord-tuning'))) {
            const group = await box(rowOf('feat'));
            if (group) { await clickAt(group.x, group.y); await sleep(900); }
        }
        if (!await box(leaf('nord-tuning'))) {
            const group = await box(rowOf('feat'));
            if (group) { await clickAt(group.left + 12, group.y); await sleep(900); }
        }
        await rightClick(leaf('nord-tuning'));
        await sleep(1300);
        await click(byText('div,span,button', 'Merge into'));
        await sleep(3200);
    });

    await step('merge editor', async () => {
        await click(btn('Local Changes'));
        await sleep(2200);
        const conflicted = await box(leaf('theme.json'));
        if (conflicted) { await clickAt(conflicted.x, conflicted.y); await sleep(1800); }
        await click(`[...document.querySelectorAll('button')].find(b => /merge editor|resolve|gitbox/i.test(b.innerText))`);
        await focusWindow("merge", 12000);
        await sleep(1500);
        await sleep(3500);
        await scroll(600, 400, 250);
        await sleep(2500);
        await scroll(600, 400, -250);
        await sleep(1500);
        await focusMain();
        await sleep(1200);
    });

    // ── What it actually ran ─────────────────────────────────────────────
    await step('command log', async () => {
        await click(byText('div,span,button', 'Command Log'));
        await sleep(3000);
        await scroll(700, 600, 200);
        await sleep(1600);
    });

    // ── Analytics ────────────────────────────────────────────────────────
    await step('statistics', async () => {
        await click(byText('div,span,button', 'Statistics'));
        await sleep(3800);
        await scroll(700, 500, 300);
        await sleep(2000);
        await scroll(700, 500, 300);
        await sleep(2000);
        await scroll(700, 500, -600);
        await sleep(1200);
    });

    // ── Settings ─────────────────────────────────────────────────────────
    await step('settings', async () => {
        await key(',', 2);   // Ctrl+, — the app's own shortcut, no icon to hunt for
        await sleep(2400);
        await scroll(700, 500, 300);
        await sleep(2200);
        await scroll(700, 500, -300);
        await sleep(1200);
        // Git & Tools is deliberately not opened: it shows the machine's git
        // identity — name, address and the Gravatar fetched for it — and this
        // video is published.
        await click(byText('div,span,button', 'Appearance'));
        await sleep(2800);
        await click(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Install')`);
        await sleep(4500);
        await key('Escape');
        await sleep(2000);
    });

    await step('back to the graph', async () => {
        await click(btn('History'));
        await sleep(2500);
        const anchor = await box(leaf('GRAPH & SUBJECT'));
        if (anchor) await move(anchor.x, anchor.y + 200);
        await sleep(1400);
    });

    log('storyboard finished');
}
