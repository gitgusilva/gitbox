'use strict';

// Regression tests for the promise that makes GitBox portable: gitbox_addon.node
// must carry libgit2, libssh2, mbedTLS and OpenSSL *inside* itself and import
// nothing from the host beyond the C/C++ runtime and Node's own N-API.
//
// This is what broke in issue #1. binding.gyp linked libssh2.a but not the
// vendored libcrypto.a, so libssh2's crypt-method table kept unresolved data
// relocations (R_X86_64_64) to EVP_des_ede3_cbc & friends. Nothing failed at
// build time, and nothing failed under plain `node` either — node exports its
// own statically linked OpenSSL, so the addon quietly borrowed those symbols.
// Electron ships BoringSSL and exports no EVP_des_ede3_cbc, so the packaged app
// died at startup on any machine that did not happen to have a libcrypto
// already mapped into the process:
//
//   Error: .../gitbox_addon.node: undefined symbol: EVP_des_ede3_cbc
//
// Because "does it load?" depends on what the host has lying around, the
// authoritative test here is the static import audit, not a runtime load.
//
// Run with: npm test   (from core/addon, after building the addon)

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// GITBOX_ADDON_PATH lets this audit run against any build of the addon (a
// packaged one, or a deliberately broken one to prove the audit still bites).
const ADDON = process.env.GITBOX_ADDON_PATH
    ? path.resolve(process.env.GITBOX_ADDON_PATH)
    : path.join(__dirname, '..', 'build', 'Release', 'gitbox_addon.node');

// Symbols that must never be imported: they belong to the libraries we vendor
// and statically link, so seeing one as *undefined* means an archive is missing
// from binding.gyp and the host is being asked to supply it.
const VENDORED_SYMBOLS = [
    // OpenSSL / BoringSSL surface (libssh2's crypto backend)
    /^(EVP|SSL|BIO|ERR|RSA|DSA|DH|EC|ECDSA|ECDH|BN|X509|ASN1|PEM|HMAC|CMAC|OPENSSL|OSSL|CRYPTO|RAND|OBJ|NCONF|CONF|UI|ENGINE|PKCS|SHA1|SHA224|SHA256|SHA384|SHA512|MD5|AES|DES|d2i|i2d)_/,
    /^(libssh2|git|mbedtls|psa)_/, // libssh2, libgit2, mbedTLS
    /^(deflate|inflate|compress|uncompress|crc32|adler32|zlib)/, // bundled zlib
];

const ALLOWED_DEPS = {
    linux: [
        /^libc\.so\.\d+$/,
        /^libm\.so\.\d+$/,
        /^libstdc\+\+\.so\.\d+$/,
        /^libgcc_s\.so\.\d+$/,
        /^libdl\.so\.\d+$/,
        /^libpthread\.so\.\d+$/,
        /^librt\.so\.\d+$/,
        /^ld-linux.*\.so.*$/,
    ],
    darwin: [/^\/usr\/lib\//, /^\/System\/Library\//],
    win32: [
        /^(KERNEL32|USER32|ADVAPI32|CRYPT32|WS2_32|RPCRT4|SECUR32|OLE32|BCRYPT|SHELL32|SHLWAPI|OLEAUT32|VERSION|DBGHELP|WINMM|PSAPI|USERENV|IPHLPAPI|api-ms-win-.*|VCRUNTIME.*|ucrtbase|MSVCP.*|node)\.(dll|DLL|exe|EXE)$/i,
    ],
};

function tool(name) {
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name]);
    return probe.status === 0;
}

function run(cmd, args) {
    const out = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (out.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${out.stderr}`);
    return out.stdout;
}

// Undefined (imported) dynamic symbols, version suffix stripped.
function importedSymbols(file) {
    const flag = process.platform === 'darwin' ? '-u' : '-D --undefined-only';
    const out = run('nm', [...flag.split(' '), file]);
    return [
        ...new Set(
            out
                .split('\n')
                .map((line) => {
                    const m = line.match(/^\s*(?:[0-9a-f]*\s+)?U\s+(\S+)$/) || line.match(/^\s*(_?\w[\w.$]*)$/);
                    return m ? m[1].replace(/@.*$/, '') : null;
                })
                .filter(Boolean)
                // Mach-O prefixes every C symbol with an underscore.
                .map((s) => (process.platform === 'darwin' ? s.replace(/^_/, '') : s)),
        ),
    ];
}

// Symbols the file defines itself (static symbol table, not just exports: the
// linker flags hide the vendored ones from .dynsym on purpose).
function definedSymbols(file) {
    const out = run('nm', ['--defined-only', file]);
    return new Set(
        out
            .split('\n')
            .map((line) => line.trim().split(/\s+/).pop())
            .filter(Boolean)
            .map((s) => (process.platform === 'darwin' ? s.replace(/^_/, '') : s)),
    );
}

function dynamicDeps(file) {
    if (process.platform === 'linux') {
        return run('readelf', ['-d', file])
            .split('\n')
            .map((l) => l.match(/\(NEEDED\)\s+Shared library: \[(.+)\]/))
            .filter(Boolean)
            .map((m) => m[1]);
    }
    if (process.platform === 'darwin') {
        return run('otool', ['-L', file])
            .split('\n')
            .slice(1)
            .map((l) => l.trim().split(/\s+/)[0])
            .filter(Boolean);
    }
    return run('dumpbin', ['/dependents', file])
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /\.dll$/i.test(l));
}

// Every symbol the C runtime we link against can supply, so the audit does not
// need a hand-maintained list of libc names.
function runtimeExports(file) {
    const exports = new Set();
    for (const line of run('ldd', [file]).split('\n')) {
        // "libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x…)" plus the dynamic
        // loader's own "/lib64/ld-linux-x86-64.so.2 (0x…)" line, which has no
        // "=>" — miss it and __tls_get_addr looks like an unresolved import.
        const m = line.match(/=>\s*(\/\S+)/) || line.match(/^\s*(\/\S+)\s+\(0x/);
        if (!m) continue;
        for (const sym of run('nm', ['-D', '--defined-only', m[1]]).split('\n')) {
            const name = sym.trim().split(/\s+/).pop();
            if (name) exports.add(name.replace(/@.*$/, ''));
        }
    }
    return exports;
}

const EXPORTS = ['status', 'log', 'branches', 'fetch', 'pull', 'push', 'clone', 'mergeBranch'];

const built = fs.existsSync(ADDON);
const canInspect = tool('nm') && (process.platform !== 'linux' || tool('readelf'));

const skip = built ? false : `${ADDON} not built — run "npm run build" first`;

// Keep these checks flat. node 20 (what CI runs) does not await subtests
// declared inside a synchronous parent test: it cancels them and reports
// "test did not finish before its parent", so a nested suite passes locally on
// node 22+ while quietly running one of six checks on CI.

test('imports nothing from the vendored crypto/git libraries (issue #1)', { skip }, (t) => {
    if (!canInspect) return t.skip('nm/readelf unavailable on this host');

    const leaked = importedSymbols(ADDON).filter((s) => VENDORED_SYMBOLS.some((re) => re.test(s)));

    assert.deepStrictEqual(
        leaked,
        [],
        `The addon expects the host to provide ${leaked.length} symbol(s) that should be ` +
            `statically linked into it: ${leaked.slice(0, 12).join(', ')}. This is issue #1: an ` +
            `archive is missing from binding.gyp's libraries list (libssh2 needs the vendored ` +
            `libcrypto.a after it), so the app dies at startup under Electron with ` +
            `"undefined symbol: ${leaked[0]}".`,
    );
});

test('every imported symbol resolves from the C runtime or N-API', { skip }, (t) => {
    if (process.platform !== 'linux' || !canInspect || !tool('ldd')) {
        return t.skip('ldd-based resolution check runs on Linux only');
    }

    const available = runtimeExports(ADDON);
    const unresolved = importedSymbols(ADDON).filter(
        (s) => !available.has(s) && !/^(napi_|node_api_)/.test(s),
    );

    assert.deepStrictEqual(
        unresolved,
        [],
        `Imported symbols that no linked library provides: ${unresolved.join(', ')}. ` +
            `They would only resolve if the host process happened to have a matching ` +
            `library mapped in — exactly the fragility behind issue #1.`,
    );
});

test('links no shared library beyond the C/C++ runtime', { skip }, (t) => {
    const allowed = ALLOWED_DEPS[process.platform];
    if (!allowed) return t.skip(`no dependency allowlist for ${process.platform}`);
    if (process.platform === 'win32' && !tool('dumpbin')) return t.skip('dumpbin unavailable');

    const unexpected = dynamicDeps(ADDON).filter((dep) => !allowed.some((re) => re.test(dep)));

    assert.deepStrictEqual(
        unexpected,
        [],
        `The addon must not depend on system libraries: ${unexpected.join(', ')}. ` +
            `GitBox ships no git/libgit2/OpenSSL runtime, so anything here breaks the ` +
            `AppImage and every distro whose version differs.`,
    );
});

test('statically contains libgit2, libssh2, mbedTLS and OpenSSL', { skip }, (t) => {
    if (!canInspect) return t.skip('nm unavailable on this host');
    if (process.platform === 'win32') return t.skip('SSH/OpenSSL are not enabled on Windows yet');

    const defined = definedSymbols(ADDON);
    // One representative symbol per vendored library. EVP_des_ede3_cbc is
    // the one issue #1 reported missing, so it is the canary here.
    for (const symbol of [
        'git_libgit2_init',
        'libssh2_session_init_ex',
        'mbedtls_ssl_init',
        'EVP_des_ede3_cbc',
    ]) {
        assert.ok(
            defined.has(symbol),
            `${symbol} is not compiled into the addon — its library was dropped from ` +
                `binding.gyp or built without the feature.`,
        );
    }
});

// Node-API keeps the addon ABI-stable, so this loads under any node or Electron
// version — the point is that it loads at all.
test('loads and exposes the native git API', { skip }, () => {
    const addon = require(ADDON);
    for (const fn of EXPORTS) assert.strictEqual(typeof addon[fn], 'function', `missing export: ${fn}`);
});

// The runtime that actually broke in issue #1. Weaker than the audits above (a
// host with a compatible libcrypto already mapped into the process can mask a
// missing archive), but it is the exact failing path users hit.
test('loads inside Electron, the runtime that ships BoringSSL', { skip }, (t) => {
    const electron = electronBinary();
    if (!electron) return t.skip('no electron binary installed under ui/electron');

    const probe = spawnSync(
        electron,
        ['-e', `console.log(Object.keys(require(${JSON.stringify(ADDON)})).join(','))`],
        { encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
    );

    assert.strictEqual(
        probe.status,
        0,
        `Electron could not load the addon: ${(probe.stderr || '').trim()}`,
    );
    const keys = probe.stdout.trim().split('\n').pop().split(',');
    for (const fn of EXPORTS) assert.ok(keys.includes(fn), `missing export: ${fn}`);
});

function electronBinary() {
    try {
        const pkg = path.join(__dirname, '..', '..', '..', 'ui', 'electron', 'node_modules', 'electron');
        const exe = fs.readFileSync(path.join(pkg, 'path.txt'), 'utf8').trim();
        const full = path.join(pkg, 'dist', exe);
        return fs.existsSync(full) ? full : null;
    } catch {
        return null;
    }
}
