const path = require('path');

const isDev = process.env.NODE_ENV === 'development';
const isPackaged = process.versions.electron && !isDev;

let addon;
if (isPackaged) {
    // bindings() struggles with asar archives, hardcode path for packaged
    addon = require('./build/Release/gitbox_addon.node');
} else {
    const bindings = require('bindings');
    addon = bindings('gitbox_addon');
}

// Native HTTPS uses a bundled mbedTLS, which has no system CA store. Point
// libgit2 at the CA bundle we ship so TLS certificate verification works.
try {
    let caFile = path.join(__dirname, 'certs', 'cacert.pem');
    // In a packaged app the addon + certs are extracted from the asar archive;
    // native code must read the unpacked copy, not the path inside app.asar.
    caFile = caFile.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
    if (typeof addon.setTlsCertFile === 'function') {
        addon.setTlsCertFile(caFile);
    }
} catch (_) {
    // Non-fatal: HTTPS with a private CA may fail, but local ops still work.
}

module.exports = addon;
