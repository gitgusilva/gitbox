const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gitbox', {
  // ==========================================
  // Git Core Operations
  // ==========================================
  status: (repoPath) => ipcRenderer.invoke('gitbox:status', repoPath),
  log: (repoPath, maxCount = 20, refName = '') => ipcRenderer.invoke('gitbox:log', repoPath, maxCount, refName),
  branches: (repoPath) => ipcRenderer.invoke('gitbox:branches', repoPath),
  remotes: (repoPath) => ipcRenderer.invoke('gitbox:remotes', repoPath),
  tags: (repoPath) => ipcRenderer.invoke('gitbox:tags', repoPath),
  stashes: (repoPath) => ipcRenderer.invoke('gitbox:stashes', repoPath),
  getSubmodules: (repoPath) => ipcRenderer.invoke('gitbox:getSubmodules', repoPath),
  addSubmodule: (repoPath, url, path) => ipcRenderer.invoke('gitbox:addSubmodule', repoPath, url, path),
  updateSubmodule: (repoPath, path) => ipcRenderer.invoke('gitbox:updateSubmodule', repoPath, path),
  deleteSubmodule: (repoPath, path) => ipcRenderer.invoke('gitbox:deleteSubmodule', repoPath, path),
  getRemoteUrl: (repoPath, remoteName) => ipcRenderer.invoke('gitbox:getRemoteUrl', repoPath, remoteName),
  getConfig: (repoPath) => ipcRenderer.invoke('gitbox:getConfig', repoPath),
  setConfig: (repoPath, name, email) => ipcRenderer.invoke('gitbox:setConfig', repoPath, name, email),

  // ==========================================
  // Git Flow (Fetch, Pull, Push, Checkout)
  // ==========================================
  fetch: (repoPath, remoteName = 'origin') => ipcRenderer.invoke('gitbox:fetch', repoPath, remoteName),
  pull: (repoPath, remoteName) => ipcRenderer.invoke('gitbox:pull', repoPath, remoteName),
  push: (repoPath, remoteName) => ipcRenderer.invoke('gitbox:push', repoPath, remoteName),
  checkoutBranch: (repoPath, branchName) => ipcRenderer.invoke('gitbox:checkoutBranch', repoPath, branchName),
  checkMerge: (repoPath, toBranch, fromBranch) => ipcRenderer.invoke('gitbox:checkMerge', repoPath, toBranch, fromBranch),

  // ==========================================
  // Git Modifications (Staging, Committing, Diffs)
  // ==========================================
  stageAll: (repoPath) => ipcRenderer.invoke('gitbox:stageAll', repoPath),
  stageFile: (repoPath, filePath) => ipcRenderer.invoke('gitbox:stageFile', repoPath, filePath),
  unstageAll: (repoPath) => ipcRenderer.invoke('gitbox:unstageAll', repoPath),
  unstageFile: (repoPath, filePath) => ipcRenderer.invoke('gitbox:unstageFile', repoPath, filePath),
  discardAll: (repoPath) => ipcRenderer.invoke('gitbox:discardAll', repoPath),
  discardFile: (repoPath, filePath) => ipcRenderer.invoke('gitbox:discardFile', repoPath, filePath),
  commitAll: (repoPath, message) => ipcRenderer.invoke('gitbox:commitAll', repoPath, message),
  commitFiles: (repoPath, commitId) => ipcRenderer.invoke('gitbox:commitFiles', repoPath, commitId),
  diffFile: (repoPath, filePath) => ipcRenderer.invoke('gitbox:diffFile', repoPath, filePath),
  diffCommitFile: (repoPath, commitId, filePath) => ipcRenderer.invoke('gitbox:diffCommitFile', repoPath, commitId, filePath),
  getStagedDiff: (repoPath) => ipcRenderer.invoke('gitbox:getStagedDiff', repoPath),
  getFileDiff: (repoPath, filePath) => ipcRenderer.invoke('gitbox:getFileDiff', repoPath, filePath),
  getFileBlame: (repoPath, filePath) => ipcRenderer.invoke('gitbox:getFileBlame', repoPath, filePath),
  stashChanges: (repoPath, stashId) => ipcRenderer.invoke('gitbox:stashChanges', repoPath, stashId),
  stashSave: (repoPath, message) => ipcRenderer.invoke('gitbox:stashSave', repoPath, message),
  stashPop: (repoPath, stashId) => ipcRenderer.invoke('gitbox:stashPop', repoPath, stashId),
  stashDrop: (repoPath, stashId) => ipcRenderer.invoke('gitbox:stashDrop', repoPath, stashId),
  createBranch: (repoPath, name) => ipcRenderer.invoke('gitbox:createBranch', repoPath, name),
  deleteBranch: (repoPath, name) => ipcRenderer.invoke('gitbox:deleteBranch', repoPath, name),
  diffStashFile: (repoPath, stashId, filePath) => ipcRenderer.invoke('gitbox:diffStashFile', repoPath, stashId, filePath),

  // ==========================================
  // Terminal Operations
  // ==========================================
  spawnTerminal: (repoPath) => ipcRenderer.invoke('terminal:spawn', repoPath),
  writeTerminal: (id, data) => ipcRenderer.send('terminal:write', id, data),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
  killTerminal: (id) => ipcRenderer.send('terminal:kill', id),
  onTerminalData: (callback) => ipcRenderer.on('terminal:data', (_, id, data) => callback(id, data)),
  onTerminalExit: (callback) => ipcRenderer.on('terminal:exit', (_, id) => callback(id)),

  // ==========================================
  // File System
  // ==========================================
  listFiles: (repoPath) => ipcRenderer.invoke('gitbox:listFiles', repoPath),
  getFileContent: (repoPath, filePath) => ipcRenderer.invoke('gitbox:getFileContent', repoPath, filePath),
  saveFile: (repoPath, filePath, content) => ipcRenderer.invoke('gitbox:saveFile', repoPath, filePath, content),

  // ==========================================
  // System / App
  // ==========================================
  selectFolder: () => ipcRenderer.invoke('gitbox:selectFolder'),
  openExternal: (url) => ipcRenderer.invoke('gitbox:openExternal', url),
  getAppChangelog: () => ipcRenderer.invoke('gitbox:getAppChangelog'),
  onProtocolUrl: (callback) => ipcRenderer.on('protocol:url', (_, url) => callback(url)),

  // ==========================================
  // Storage
  // ==========================================
  storeGet: (key) => ipcRenderer.sendSync('store:get', key),
  storeSet: (key, value) => ipcRenderer.sendSync('store:set', key, value),
  storeDelete: (key) => ipcRenderer.sendSync('store:delete', key),

  // ==========================================
  // Window Controls
  // ==========================================
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  setZoom: (factor) => ipcRenderer.send('window:zoom', factor),
});
