const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gitbox', {
  // ==========================================
  // Git Core Operations
  // ==========================================
  status: (repoPath) => ipcRenderer.invoke('gitbox:status', repoPath),
  log: (repoPath, maxCount = 20, refName = '', skip = 0) => ipcRenderer.invoke('gitbox:log', repoPath, maxCount, refName, skip),
  branches: (repoPath) => ipcRenderer.invoke('gitbox:branches', repoPath),
  remotes: (repoPath) => ipcRenderer.invoke('gitbox:remotes', repoPath),
  tags: (repoPath) => ipcRenderer.invoke('gitbox:tags', repoPath),
  stashes: (repoPath) => ipcRenderer.invoke('gitbox:stashes', repoPath),
  getSubmodules: (repoPath) => ipcRenderer.invoke('gitbox:getSubmodules', repoPath),
  addSubmodule: (repoPath, url, path) => ipcRenderer.invoke('gitbox:addSubmodule', repoPath, url, path),
  updateSubmodule: (repoPath, path) => ipcRenderer.invoke('gitbox:updateSubmodule', repoPath, path),
  deleteSubmodule: (repoPath, path) => ipcRenderer.invoke('gitbox:deleteSubmodule', repoPath, path),
  getSubmoduleCommitInfo: (repoPath, submodulePath, sha) => ipcRenderer.invoke('gitbox:getSubmoduleCommitInfo', repoPath, submodulePath, sha),
  getRemoteUrl: (repoPath, remoteName) => ipcRenderer.invoke('gitbox:getRemoteUrl', repoPath, remoteName),
  getConfig: (repoPath) => ipcRenderer.invoke('gitbox:getConfig', repoPath),
  setConfig: (repoPath, name, email) => ipcRenderer.invoke('gitbox:setConfig', repoPath, name, email),
  getGlobalConfig: () => ipcRenderer.invoke('gitbox:getGlobalConfig'),
  setGlobalConfig: (name, email) => ipcRenderer.invoke('gitbox:setGlobalConfig', name, email),

  // ==========================================
  // Git Flow (Fetch, Pull, Push, Checkout)
  // ==========================================
  fetch: (repoPath, remoteName = 'origin') => ipcRenderer.invoke('gitbox:fetch', repoPath, remoteName),
  pull: (repoPath, remoteName) => ipcRenderer.invoke('gitbox:pull', repoPath, remoteName),
  push: (repoPath, remoteName, branchName, setUpstream, force, pushTags) => ipcRenderer.invoke('gitbox:push', repoPath, remoteName, branchName, setUpstream, force, pushTags),
  checkoutBranch: (repoPath, branchName) => ipcRenderer.invoke('gitbox:checkoutBranch', repoPath, branchName),
  checkMerge: (repoPath, toBranch, fromBranch) => ipcRenderer.invoke('gitbox:checkMerge', repoPath, toBranch, fromBranch),
  openMergeTool: (repoPath, filePath, toolName) => ipcRenderer.invoke('gitbox:openMergeTool', repoPath, filePath, toolName),
  openMergeWindow: (repoPath, filePath) => ipcRenderer.invoke('gitbox:openMergeWindow', repoPath, filePath),
  mergeBranch: (repoPath, branchName, noFastForward) => ipcRenderer.invoke('gitbox:mergeBranch', repoPath, branchName, noFastForward),
  mergeContinue: (repoPath, message) => ipcRenderer.invoke('gitbox:mergeContinue', repoPath, message),
  mergeAbort: (repoPath) => ipcRenderer.invoke('gitbox:mergeAbort', repoPath),
  repoState: (repoPath) => ipcRenderer.invoke('gitbox:repoState', repoPath),
  notifyMergeResolved: () => ipcRenderer.send('merge:resolved'),
  onMergeResolved: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('merge:resolved-broadcast', listener);
    return () => ipcRenderer.removeListener('merge:resolved-broadcast', listener);
  },

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
  commitDiff: (repoPath, commitId) => ipcRenderer.invoke('gitbox:commitDiff', repoPath, commitId),
  getStagedDiff: (repoPath) => ipcRenderer.invoke('gitbox:getStagedDiff', repoPath),
  getFileDiff: (repoPath, filePath) => ipcRenderer.invoke('gitbox:getFileDiff', repoPath, filePath),
  getFileBlame: (repoPath, filePath, rev) => ipcRenderer.invoke('gitbox:getFileBlame', repoPath, filePath, rev),
  stashChanges: (repoPath, stashId) => ipcRenderer.invoke('gitbox:stashChanges', repoPath, stashId),
  stashSave: (repoPath, message) => ipcRenderer.invoke('gitbox:stashSave', repoPath, message),
  stashPop: (repoPath, stashId) => ipcRenderer.invoke('gitbox:stashPop', repoPath, stashId),
  stashDrop: (repoPath, stashId) => ipcRenderer.invoke('gitbox:stashDrop', repoPath, stashId),
  createBranch: (repoPath, name, startPoint) => ipcRenderer.invoke('gitbox:createBranch', repoPath, name, startPoint),
  deleteBranch: (repoPath, name) => ipcRenderer.invoke('gitbox:deleteBranch', repoPath, name),
  createTag: (repoPath, tagName, commitSha) => ipcRenderer.invoke('gitbox:createTag', repoPath, tagName, commitSha),
  rewordCommit: (repoPath, commitSha, newMessage) => ipcRenderer.invoke('gitbox:rewordCommit', repoPath, commitSha, newMessage),
  squashCommit: (repoPath, commitSha) => ipcRenderer.invoke('gitbox:squashCommit', repoPath, commitSha),
  revertCommit: (repoPath, commitSha) => ipcRenderer.invoke('gitbox:revertCommit', repoPath, commitSha),
  diffStashFile: (repoPath, stashId, filePath) => ipcRenderer.invoke('gitbox:diffStashFile', repoPath, stashId, filePath),

  // ==========================================
  // Terminal Operations
  // ==========================================
  spawnTerminal: (repoPath) => ipcRenderer.invoke('terminal:spawn', repoPath),
  writeTerminal: (id, data) => ipcRenderer.send('terminal:write', id, data),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
  killTerminal: (id) => ipcRenderer.send('terminal:kill', id),
  onTerminalData: (callback) => {
    const listener = (_, id, data) => callback(id, data);
    ipcRenderer.on('terminal:data', listener);
    return () => ipcRenderer.removeListener('terminal:data', listener);
  },
  onTerminalExit: (callback) => {
    const listener = (_, id) => callback(id);
    ipcRenderer.on('terminal:exit', listener);
    return () => ipcRenderer.removeListener('terminal:exit', listener);
  },

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
  getAppVersion: () => ipcRenderer.invoke('gitbox:getAppVersion'),
  debugMark: (label) => { try { ipcRenderer.sendSync('debug:mark', label); } catch (e) {} },
  detectExternalTools: () => ipcRenderer.invoke('gitbox:detectExternalTools'),
  detectAiClis: () => ipcRenderer.invoke('gitbox:detectAiClis'),
  aiRunCli: (cliId, prompt) => ipcRenderer.invoke('gitbox:aiRunCli', cliId, prompt),
  onProtocolUrl: (callback) => {
    const listener = (_, url) => callback(url);
    ipcRenderer.on('protocol:url', listener);
    return () => ipcRenderer.removeListener('protocol:url', listener);
  },

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
  onGitLog: (callback) => {
    const listener = (_, repoPath, cmd, stdout, stderr, duration, exitCode) => callback(repoPath, cmd, stdout, stderr, duration, exitCode);
    ipcRenderer.on('git:log-entry', listener);
    return () => ipcRenderer.removeListener('git:log-entry', listener);
  },
});
