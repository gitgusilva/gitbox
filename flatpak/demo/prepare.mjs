// Puts the freshly started app into the state the storyboard expects: the demo
// repository open on the history view.
//
// The repository is opened by seeding the store and clicking the entry the app
// then shows under "Recent", because the Open button raises a native folder
// dialog that no amount of DevTools can reach.
const PORT = process.env.CDP_PORT || 9222;
const REPO = process.env.REPO_PATH;

const sleep = ms => new Promise(r => setTimeout(r, ms));

let nextId = 0;
const pending = new Map();

async function main() {
    if (!REPO) throw new Error('REPO_PATH is not set');

    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find(t => t.type === 'page' && t.url.includes('index.html'));
    if (!page) throw new Error('no GitBox window on the debugging port');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.addEventListener('message', ev => {
        const msg = JSON.parse(ev.data);
        const waiter = pending.get(msg.id);
        if (!waiter) return;
        pending.delete(msg.id);
        msg.error ? waiter.reject(new Error(JSON.stringify(msg.error))) : waiter.resolve(msg.result);
    });

    const send = (method, params = {}) => {
        const id = ++nextId;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    };
    const evaluate = async expression => {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval threw');
        return r.result.value;
    };

    await send('Runtime.enable');

    const name = REPO.split('/').filter(Boolean).pop();
    await evaluate(`(() => {
        const recent = [{ name: ${JSON.stringify(name)}, path: ${JSON.stringify(REPO)}, color: '#8b5cf6', lastOpened: 1 }];
        window.gitbox.storeSet('gitbox_recent_repos', JSON.stringify(recent));
        location.reload();
    })()`);
    await sleep(4000);

    const spot = await evaluate(`(() => {
        const label = [...document.querySelectorAll('*')]
            .find(e => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(name)});
        if (!label) return null;
        const r = label.parentElement.parentElement.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    if (!spot) throw new Error('the repository did not appear under Recent');

    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: spot.x, y: spot.y, buttons: 0 });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: spot.x, y: spot.y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: spot.x, y: spot.y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(4000);

    const size = await evaluate('({ w: innerWidth, h: innerHeight })');
    const opened = await evaluate(`document.body.innerText.includes('GRAPH & SUBJECT')`);
    console.log(opened ? `  ${name} is open at ${size.w}x${size.h}` : '  repository did not open');
    ws.close();
}

main().catch(e => { console.error(String(e.message || e)); process.exit(1); });
