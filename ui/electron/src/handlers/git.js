const { ipcMain } = require('electron');

const Submodule = require('../Commands/Submodule');
const Add = require('../Commands/Add');
const Reset = require('../Commands/Reset');
const Discard = require('../Commands/Discard');
const Diff = require('../Commands/Diff');
const Blame = require('../Commands/Blame');
const Commit = require('../Commands/Commit');
const Tag = require('../Commands/Tag');
const Stash = require('../Commands/Stash');
const Log = require('../Commands/Log');
const Branch = require('../Commands/Branch');
const Checkout = require('../Commands/Checkout');
const Remote = require('../Commands/Remote');
const Merge = require('../Commands/Merge');
const Status = require('../Commands/Status');
const Config = require('../Commands/Config');
const Fetch = require('../Commands/Fetch');
const Pull = require('../Commands/Pull');
const Push = require('../Commands/Push');
const GitFlow = require('../Commands/GitFlow');
const Archive = require('../Commands/Archive');
const Patch = require('../Commands/Patch');

module.exports = function (addon) {
    // Instanciar classes de comandos como serviços/Singletons
    const submoduleCmd = new Submodule(addon);
    const addCmd = new Add(addon);
    const resetCmd = new Reset(addon);
    const discardCmd = new Discard(addon);
    const diffCmd = new Diff(addon);
    const blameCmd = new Blame(addon);
    const commitCmd = new Commit(addon);
    const tagCmd = new Tag(addon);
    const stashCmd = new Stash(addon);
    const logCmd = new Log(addon);
    const branchCmd = new Branch(addon);
    const checkoutCmd = new Checkout(addon);
    const remoteCmd = new Remote(addon);
    const mergeCmd = new Merge(addon);
    const statusCmd = new Status(addon);
    const configCmd = new Config(addon);
    const fetchCmd = new Fetch(addon);
    const pullCmd = new Pull(addon);
    const pushCmd = new Push(addon);
    const gitFlowCmd = new GitFlow(addon);
    const archiveCmd = new Archive(addon);
    const patchCmd = new Patch(addon);

    ipcMain.handle('gitbox:status', async (_, repoPath) => statusCmd.get(repoPath));
    ipcMain.handle('gitbox:branches', async (_, repoPath) => branchCmd.getBranches(repoPath));
    ipcMain.handle('gitbox:remotes', async (_, repoPath) => remoteCmd.getRemotes(repoPath));

    // Submodule
    console.log('[Handlers] Registering submodule handlers...');
    ipcMain.handle('gitbox:getSubmodules', async (_, repoPath) => submoduleCmd.get(repoPath));
    ipcMain.handle('gitbox:addSubmodule', async (_, repoPath, url, targetPath) => submoduleCmd.add(repoPath, url, targetPath));
    ipcMain.handle('gitbox:deleteSubmodule', async (_, repoPath, submodulePath) => submoduleCmd.delete(repoPath, submodulePath));
    ipcMain.handle('gitbox:updateSubmodule', async (_, repoPath, submodulePath) => submoduleCmd.update(repoPath, submodulePath));
    ipcMain.handle('gitbox:getSubmoduleCommitInfo', async (_, repoPath, submodulePath, sha) => {
        console.log(`[IPC] getSubmoduleCommitInfo for ${submodulePath} at ${sha}`);
        return submoduleCmd.getCommitInfo(repoPath, submodulePath, sha);
    });

    // Tags
    ipcMain.handle('gitbox:tags', async (_, repoPath) => tagCmd.getTags(repoPath));
    ipcMain.handle('gitbox:createTag', async (_, repoPath, tagName, commitSha) => tagCmd.create(repoPath, tagName, commitSha));

    // Stashes
    ipcMain.handle('gitbox:stashes', async (_, repoPath) => stashCmd.getStashes(repoPath));
    ipcMain.handle('gitbox:stashSave', async (_, repoPath, message) => stashCmd.save(repoPath, message));
    ipcMain.handle('gitbox:stashChanges', async (_, repoPath, stashId) => stashCmd.changes(repoPath, stashId));
    ipcMain.handle('gitbox:stashPop', async (_, repoPath, stashId) => stashCmd.pop(repoPath, stashId));
    ipcMain.handle('gitbox:stashDrop', async (_, repoPath, stashId) => stashCmd.drop(repoPath, stashId));

    // Commits
    ipcMain.handle('gitbox:log', async (_, repoPath, maxCount, refName, skip) => logCmd.getLog(repoPath, maxCount, refName, skip));
    ipcMain.handle('gitbox:commitAll', async (_, repoPath, message) => commitCmd.all(repoPath, message));
    ipcMain.handle('gitbox:commitFiles', async (_, repoPath, commitId) => commitCmd.files(repoPath, commitId));
    ipcMain.handle('gitbox:rewordCommit', async (_, repoPath, commitSha, newMessage) => commitCmd.reword(repoPath, commitSha, newMessage));
    ipcMain.handle('gitbox:squashCommit', async (_, repoPath, commitSha) => commitCmd.squash(repoPath, commitSha));
    ipcMain.handle('gitbox:revertCommit', async (_, repoPath, commitSha) => commitCmd.revert(repoPath, commitSha));
    ipcMain.handle('gitbox:commitAmend', async (_, repoPath, message) => commitCmd.amend(repoPath, message));

    // Stage / Unstage / Discard
    ipcMain.handle('gitbox:stageAll', async (_, repoPath) => addCmd.all(repoPath));
    ipcMain.handle('gitbox:stageFile', async (_, repoPath, filePath) => addCmd.file(repoPath, filePath));
    ipcMain.handle('gitbox:unstageAll', async (_, repoPath) => resetCmd.all(repoPath));
    ipcMain.handle('gitbox:unstageFile', async (_, repoPath, filePath) => resetCmd.file(repoPath, filePath));
    ipcMain.handle('gitbox:discardAll', async (_, repoPath) => discardCmd.all(repoPath));
    ipcMain.handle('gitbox:discardFile', async (_, repoPath, filePath) => discardCmd.file(repoPath, filePath));

    // Branches / Checkout
    ipcMain.handle('gitbox:checkoutBranch', async (_, repoPath, branchName) => checkoutCmd.branch(repoPath, branchName));
    ipcMain.handle('gitbox:createBranch', async (_, repoPath, branchName, startPoint) => branchCmd.create(repoPath, branchName, startPoint));
    ipcMain.handle('gitbox:deleteBranch', async (_, repoPath, branchName) => branchCmd.delete(repoPath, branchName));

    // Diffs / Blame
    ipcMain.handle('gitbox:diffFile', async (_, repoPath, filePath) => diffCmd.file(repoPath, filePath));
    ipcMain.handle('gitbox:diffStashFile', async (_, repoPath, stashId, filePath) => diffCmd.stashFile(repoPath, stashId, filePath));
    ipcMain.handle('gitbox:getStagedDiff', async (_, repoPath) => diffCmd.staged(repoPath));
    ipcMain.handle('gitbox:getFileDiff', async (_, repoPath, filePath) => diffCmd.localFile(repoPath, filePath));
    ipcMain.handle('gitbox:diffCommitFile', async (_, repoPath, commitId, filePath) => diffCmd.commitFile(repoPath, commitId, filePath));
    ipcMain.handle('gitbox:commitDiff', async (_, repoPath, commitId) => diffCmd.commitPatch(repoPath, commitId));
    ipcMain.handle('gitbox:getFileBlame', async (_, repoPath, filePath, rev) => blameCmd.file(repoPath, filePath, rev));

    // Config
    ipcMain.handle('gitbox:getConfig', async (_, repoPath) => configCmd.get(repoPath));
    ipcMain.handle('gitbox:setConfig', async (_, repoPath, name, email) => configCmd.set(repoPath, name, email));
    ipcMain.handle('gitbox:getGlobalConfig', async () => configCmd.getGlobal());
    ipcMain.handle('gitbox:setGlobalConfig', async (_, name, email) => configCmd.setGlobal(name, email));

    // Sync
    ipcMain.handle('gitbox:fetch', async (_, repoPath, remoteName) => fetchCmd.execute(repoPath, remoteName));
    ipcMain.handle('gitbox:pull', async (_, repoPath, remoteName) => pullCmd.execute(repoPath, remoteName));
    ipcMain.handle('gitbox:push', async (_, repoPath, remoteName, branchName, setUpstream, force, pushTags) => pushCmd.execute(repoPath, remoteName, branchName, setUpstream, force, pushTags));

    // GitFlow
    ipcMain.handle('gitbox:gitFlowInit', async (_, repoPath) => gitFlowCmd.init(repoPath));
    ipcMain.handle('gitbox:gitFlowStart', async (_, repoPath, type, name) => gitFlowCmd.start(repoPath, type, name));
    ipcMain.handle('gitbox:gitFlowFinish', async (_, repoPath, type, name) => gitFlowCmd.finish(repoPath, type, name));

    // Archive / Patch
    ipcMain.handle('gitbox:archive', async (_, repoPath, commitSha, format, outputPath) => archiveCmd.create(repoPath, commitSha, format, outputPath));
    ipcMain.handle('gitbox:createPatch', async (_, repoPath, commitSha, outputPath) => patchCmd.create(repoPath, commitSha, outputPath));
    ipcMain.handle('gitbox:applyPatch', async (_, repoPath, patchPath) => patchCmd.apply(repoPath, patchPath));

    // Network / Others
    ipcMain.handle('gitbox:getRemoteUrl', async (_, repoPath, remoteName) => remoteCmd.getUrl(repoPath, remoteName));
    ipcMain.handle('gitbox:checkMerge', async (_, repoPath, toBranch, fromBranch) => mergeCmd.check(repoPath, toBranch, fromBranch));
    ipcMain.handle('gitbox:openMergeTool', async (_, repoPath, filePath, toolName) => mergeCmd.openTool(repoPath, filePath, toolName));
    ipcMain.handle('gitbox:mergeBranch', async (_, repoPath, branchName, noFastForward) => mergeCmd.branch(repoPath, branchName, noFastForward));
    ipcMain.handle('gitbox:mergeContinue', async (_, repoPath, message) => mergeCmd.complete(repoPath, message));
    ipcMain.handle('gitbox:mergeAbort', async (_, repoPath) => mergeCmd.abort(repoPath));
    ipcMain.handle('gitbox:repoState', async (_, repoPath) => mergeCmd.state(repoPath));
};
