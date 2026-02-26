const isDev = process.env.NODE_ENV === 'development';
const isPackaged = process.versions.electron && !isDev;

if (isPackaged) {
    // bindings() struggles with asar archives, hardcode path for packaged
    module.exports = require('./build/Release/gitbox_addon.node');
} else {
    const bindings = require('bindings');
    module.exports = bindings('gitbox_addon');
}
