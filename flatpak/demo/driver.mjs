// Records the app's own window through the Chrome DevTools Protocol.
//
// Page.startScreencast captures the page's compositor surface, so the video
// holds the app and nothing else on the desktop — no other windows, no cursor,
// no audio, and the frame is exactly the window. Frames arrive only when
// something changes, each carrying a timestamp, so they are re-timed into a
// constant-rate video afterwards: a screen that sits still for four seconds
// costs one frame, not a hundred.
//
// Windows GitBox opens on its own (the merge editor, the detached diff viewer)
// are separate page targets. The storyboard says which one is on camera with
// focusWindow()/focusMain(); frames from the others are dropped.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PORT = process.env.CDP_PORT || 9222;
const WORK = process.env.WORK_DIR || '/tmp/gitbox-demo-frames';
const OUT = process.env.OUT_FILE || `${process.env.HOME}/gitbox-flatpak-demo.mp4`;
const CANVAS_W = Number(process.env.CANVAS_W || 1280);
const FPS = Number(process.env.FPS || 24);
const BITRATE = process.env.BITRATE || '2600k';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`  ${msg}`);

// Input dispatched over the protocol never draws a pointer: the compositor
// cursor belongs to the desktop, and the desktop is not in frame. So the page
// gets one of its own — an arrow that travels to each target and pulses when a
// button goes down, which is the only thing that makes the video read as
// somebody using the app rather than the UI operating itself.
const CURSOR = String.raw`(() => {
    if (window.__gbCursor) return 'already running';

    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    layer.innerHTML =
        '<svg width="26" height="26" viewBox="0 0 24 24" style="position:absolute;left:0;top:0;' +
        'filter:drop-shadow(0 2px 4px rgba(0,0,0,.55))">' +
        '<path d="M5.5 2.2 L5.5 19.4 L10.1 15.1 L13.1 21.6 L15.9 20.2 L13 13.9 L19.2 13.4 Z"' +
        ' fill="#ffffff" stroke="#101014" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    const arrow = layer.firstChild;
    document.documentElement.appendChild(layer);

    let x = innerWidth / 2, y = innerHeight / 2, frame = null;
    const draw = () => { arrow.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
    draw();

    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    window.__gbCursor = {
        at: () => ({ x, y }),

        /** Travels to a point, easing in and out, and resolves on arrival. */
        move(tx, ty, ms = 380) {
            cancelAnimationFrame(frame);
            const fromX = x, fromY = y;
            const dx = tx - fromX, dy = ty - fromY;
            const distance = Math.hypot(dx, dy);
            if (distance < 2 || ms <= 0) { x = tx; y = ty; draw(); return Promise.resolve(); }
            // Short hops should not take as long as a trip across the window.
            const duration = Math.max(140, Math.min(ms, 120 + distance * 0.7));
            const start = performance.now();
            return new Promise(resolve => {
                const tick = now => {
                    const t = Math.min(1, (now - start) / duration);
                    const e = ease(t);
                    x = fromX + dx * e;
                    y = fromY + dy * e;
                    draw();
                    if (t < 1) frame = requestAnimationFrame(tick);
                    else resolve();
                };
                frame = requestAnimationFrame(tick);
            });
        },

        /** A ring that expands and fades where the button went down. */
        press(colour = 'rgba(120,170,255,0.95)') {
            const ring = document.createElement('div');
            ring.style.cssText =
                'position:absolute;left:' + x + 'px;top:' + y + 'px;width:14px;height:14px;' +
                'margin:-7px 0 0 -7px;border-radius:50%;border:2px solid ' + colour + ';' +
                'opacity:0.95;transform:scale(0.4)';
            layer.appendChild(ring);
            ring.animate(
                [{ transform: 'scale(0.4)', opacity: 0.95 }, { transform: 'scale(2.6)', opacity: 0 }],
                { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1)' },
            ).onfinish = () => ring.remove();
            arrow.animate(
                [{ scale: '1' }, { scale: '0.86' }, { scale: '1' }],
                { duration: 220, easing: 'ease-out' },
            );
            return true;
        },
    };
    return 'cursor drawn';
})()`;

class Target {
    constructor(info) {
        this.info = info;
        this.id = info.id;
        this.nextId = 0;
        this.pending = new Map();
    }

    async open() {
        this.ws = new WebSocket(this.info.webSocketDebuggerUrl);
        await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
        this.ws.addEventListener('message', ev => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                return msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
            }
            if (this.onEvent) this.onEvent(msg);
        });
        await this.send('Page.enable');
        await this.send('Runtime.enable');
        return this;
    }

    /**
     * Every request carries a deadline. A window GitBox closes takes its
     * websocket with it, and a reply that never comes would otherwise hang the
     * recording forever rather than costing one step — which is exactly what
     * happened the first time the merge editor was on camera.
     */
    send(method, params = {}, timeoutMs = 20000) {
        const id = ++this.nextId;
        try {
            this.ws.send(JSON.stringify({ id, method, params }));
        } catch (e) {
            return Promise.reject(new Error(`${method}: socket is gone`));
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`${method}: no reply in ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(id, {
                resolve: v => { clearTimeout(timer); resolve(v); },
                reject: e => { clearTimeout(timer); reject(e); },
            });
        });
    }

    async evaluate(expression) {
        const r = await this.send('Runtime.evaluate', {
            expression, awaitPromise: true, returnByValue: true, userGesture: true,
        });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval threw');
        return r.result.value;
    }
}

async function listPages() {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    return list.filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
}

async function main() {
    const pages = await listPages();
    const mainInfo = pages.find(p => p.url.includes('index.html')) || pages[0];
    if (!mainInfo) throw new Error('no GitBox window found on the debugging port');

    const frames = [];
    const targets = new Map();
    let active = null;

    const attach = async info => {
        const t = await new Target(info).open();
        // A window the user closes must not take the recording with it.
        t.ws.addEventListener('close', () => {
            for (const [, waiter] of t.pending) waiter.reject(new Error('window closed'));
            t.pending.clear();
            if (active === t) { active = mainTarget; log('window closed — camera → main window'); }
        });
        t.onEvent = msg => {
            if (msg.method !== 'Page.screencastFrame') return;
            const { data, sessionId, metadata } = msg.params;
            t.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
            if (active === t) frames.push({ data, t: metadata.timestamp });
        };
        // A window nobody can see stops painting, and stops acknowledging input
        // with it — which reads as the recording hanging. Telling the page it is
        // focused and awake keeps both going even when another window covers it.
        await t.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
        await t.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});

        await t.evaluate(CURSOR);
        await t.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
        targets.set(t.id, t);
        return t;
    };

    const mainTarget = await attach(mainInfo);
    active = mainTarget;

    // ---- what the storyboard can do -------------------------------------
    const cur = () => active;
    const evaluate = expr => cur().evaluate(expr);

    const mouse = async (type, x, y, extra = {}) =>
        cur().send('Input.dispatchMouseEvent', { type, x, y, ...extra });

    // The drawn pointer travels first and the real event lands when it arrives,
    // so hover states light up under the arrow instead of ahead of it.
    const glide = async (x, y, ms) =>
        evaluate(`window.__gbCursor ? window.__gbCursor.move(${x}, ${y}, ${ms}) : null`).catch(() => {});
    const pulse = async colour =>
        evaluate(`window.__gbCursor ? window.__gbCursor.press(${JSON.stringify(colour)}) : null`).catch(() => {});

    const move = async (x, y, ms = 380) => {
        await glide(x, y, ms);
        await mouse('mouseMoved', x, y, { buttons: 0 });
    };

    const clickAt = async (x, y) => {
        await move(x, y);
        await sleep(220);
        await pulse('rgba(120,170,255,0.95)');
        await mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
        await sleep(90);
        await mouse('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
        await sleep(180);
    };

    const rightClickAt = async (x, y) => {
        await move(x, y);
        await sleep(220);
        await pulse('rgba(255,190,120,0.95)');
        await mouse('mousePressed', x, y, { button: 'right', buttons: 2, clickCount: 1 });
        await mouse('mouseReleased', x, y, { button: 'right', buttons: 0, clickCount: 1 });
        await sleep(180);
    };

    // Takes a JS expression that evaluates to an element (or to a selector
    // string) and answers where its centre is, so a step can be written against
    // the DOM and still be delivered as a real click at real coordinates.
    const box = async expr => evaluate(`(() => {
        const found = (${expr});
        const node = typeof found === 'string' ? document.querySelector(found) : found;
        if (!node) return null;
        const r = node.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, left: r.x, top: r.y, w: r.width, h: r.height };
    })()`);

    const click = async selectorOrExpr => {
        const b = await box(selectorOrExpr);
        if (!b) throw new Error(`nothing matched: ${selectorOrExpr}`);
        await clickAt(b.x, b.y);
        return b;
    };

    const rightClick = async selectorOrExpr => {
        const b = await box(selectorOrExpr);
        if (!b) throw new Error(`nothing matched: ${selectorOrExpr}`);
        await clickAt(b.x, b.y);
        await sleep(250);
        await rightClickAt(b.x, b.y);
        return b;
    };

    // The wheel turns where the pointer is, so it has to be there first.
    const scroll = async (x, y, dy) => {
        const here = await evaluate('window.__gbCursor ? window.__gbCursor.at() : null').catch(() => null);
        if (!here || Math.hypot(here.x - x, here.y - y) > 8) await move(x, y);
        await mouse('mouseWheel', x, y, { deltaX: 0, deltaY: dy, pointerType: 'mouse' });
    };

    // Typed a character at a time so the video shows text appearing, not a
    // field that fills in one frame.
    const type = async (selector, text, delay = 38) => {
        for (const ch of text) {
            await evaluate(`(() => {
                const i = document.querySelector(${JSON.stringify(selector)});
                if (!i) return;
                i.value += ${JSON.stringify(ch)};
                i.dispatchEvent(new Event('input', { bubbles: true }));
            })()`);
            await sleep(delay);
        }
    };

    const KEYS = {
        Enter: { code: 'Enter', vk: 13 },
        Escape: { code: 'Escape', vk: 27 },
        Tab: { code: 'Tab', vk: 9 },
        ',': { code: 'Comma', vk: 188 },
    };

    // modifiers is CDP's bitmask: 2 is Ctrl, 8 is Shift.
    const key = async (k, modifiers = 0) => {
        const info = KEYS[k] || { code: k, vk: 0 };
        for (const type of ['keyDown', 'keyUp']) {
            await cur().send('Input.dispatchKeyEvent', {
                type, key: k, code: info.code, modifiers,
                windowsVirtualKeyCode: info.vk, nativeVirtualKeyCode: info.vk,
                text: type === 'keyDown' && k.length === 1 && !modifiers ? k : undefined,
            });
        }
    };

    // Waits for a window GitBox opened on its own and puts it on camera — but
    // only once it has drawn something. A window is on screen as an empty pane
    // for a moment before its view mounts, and cutting to it that early puts
    // seconds of black in the middle of the video.
    const focusWindow = async (match, timeoutMs = 8000) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            for (const info of await listPages()) {
                if (info.id === mainTarget.id || targets.has(info.id)) continue;
                if (!`${info.url} ${info.title}`.toLowerCase().includes(match.toLowerCase())) continue;
                const t = await attach(info);
                while (Date.now() < deadline) {
                    const painted = await t.evaluate('document.body.innerText.trim().length').catch(() => 0);
                    if (painted > 120) break;
                    await sleep(200);
                }
                active = t;
                log(`camera → ${info.title || info.url}`);
                return t;
            }
            await sleep(250);
        }
        throw new Error(`no window matching "${match}" opened`);
    };

    const focusMain = async () => { active = mainTarget; log('camera → main window'); };

    // A step that fails loses its beat, not the recording — and never leaves
    // the camera pointed at a window it opened, or every step after it would
    // look for its targets in the wrong document.
    const step = async (name, fn) => {
        try {
            await fn();
        } catch (e) {
            log(`skipped "${name}": ${e.message.split('\n')[0]}`);
        } finally {
            if (active !== mainTarget) { active = mainTarget; log('camera → main window'); }
        }
    };

    const api = {
        evaluate, click, clickAt, rightClick, rightClickAt, box, move, scroll,
        type, key, sleep, step, focusWindow, focusMain, log,
    };

    // ---- run the storyboard ---------------------------------------------
    const storyboard = (await import(process.env.STORYBOARD || './storyboard.mjs')).default;
    await storyboard(api);

    for (const t of targets.values()) await t.send('Page.stopScreencast').catch(() => {});
    await sleep(300);

    // ---- encode ----------------------------------------------------------
    if (!frames.length) throw new Error('no frames captured — was the window visible?');
    rmSync(WORK, { recursive: true, force: true });
    mkdirSync(WORK, { recursive: true });

    // Frames from different windows have different dimensions, and the concat
    // demuxer cannot switch resolution mid-stream. Each run of same-sized
    // frames becomes its own clip on a shared canvas; the clips then join.
    const written = frames.map((f, i) => {
        const name = `f${String(i).padStart(5, '0')}.jpg`;
        const buf = Buffer.from(f.data, 'base64');
        writeFileSync(`${WORK}/${name}`, buf);
        const next = frames[i + 1];
        return { name, size: jpegSize(buf), dur: next ? Math.max(0.02, next.t - f.t) : 1.4 };
    });

    const runs = [];
    for (const frame of written) {
        const last = runs[runs.length - 1];
        if (last && last.key === frame.size) last.items.push(frame);
        else runs.push({ key: frame.size, items: [frame] });
    }

    // A frame holds the screen until the next one arrives — but the next one
    // may come from the window the camera cut to, and that stretch is already
    // the other clip's running time. Left alone, the last frame before a cut
    // freezes for exactly as long as the segment that follows it, and the tour
    // plays a minute longer than it was recorded.
    for (const group of runs) {
        const tail = group.items[group.items.length - 1];
        tail.dur = Math.min(tail.dur, 0.8);
    }

    const canvasH = even(Math.round(CANVAS_W * heightRatio(written)));
    const clips = runs.map((group, i) => {
        const listPath = `${WORK}/list-${i}.txt`;
        const lines = [];
        for (const item of group.items) lines.push(`file '${item.name}'`, `duration ${item.dur.toFixed(3)}`);
        lines.push(`file '${group.items[group.items.length - 1].name}'`);
        writeFileSync(listPath, lines.join('\n'));

        const clip = `${WORK}/clip-${i}.mp4`;
        run(ffmpeg([
            '-f', 'concat', '-safe', '0', '-i', listPath,
            '-vf', `fps=${FPS},scale=${CANVAS_W}:${canvasH}:force_original_aspect_ratio=decrease,` +
                   `pad=${CANVAS_W}:${canvasH}:(ow-iw)/2:(oh-ih)/2:color=0x0d0d12`,
            '-c:v', 'libopenh264', '-b:v', BITRATE, '-pix_fmt', 'yuv420p', clip,
        ]));
        return clip;
    });

    if (clips.length === 1) {
        execFileSync('cp', [clips[0], OUT]);
    } else {
        const joinList = `${WORK}/clips.txt`;
        writeFileSync(joinList, clips.map(c => `file '${c}'`).join('\n'));
        run(ffmpeg(['-f', 'concat', '-safe', '0', '-i', joinList, '-c', 'copy', '-movflags', '+faststart', OUT]));
    }

    const seconds = frames[frames.length - 1].t - frames[0].t;
    console.log(`\n  ${frames.length} frames over ${seconds.toFixed(1)}s in ${clips.length} clip(s) → ${OUT}`);
    for (const t of targets.values()) t.ws.close();
}

function ffmpeg(args) { return ['-y', '-v', 'error', ...args]; }
function run(args) { execFileSync('ffmpeg', args, { stdio: 'inherit' }); }
function even(n) { return n % 2 ? n + 1 : n; }

/** Reads width/height out of a JPEG's SOF marker, to group frames by window. */
function jpegSize(buf) {
    let i = 2;
    while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
            return `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)}`;
        }
        i += 2 + buf.readUInt16BE(i + 2);
    }
    return 'unknown';
}

/** The canvas follows whichever window contributed the most frames. */
function heightRatio(written) {
    const tally = new Map();
    for (const f of written) tally.set(f.size, (tally.get(f.size) || 0) + 1);
    const [dominant] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    const [w, h] = dominant.split('x').map(Number);
    return h / w;
}

main().catch(e => { console.error(String(e.stack || e)); process.exit(1); });
