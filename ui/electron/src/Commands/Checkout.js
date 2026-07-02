/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Checkout Command Class
 */
class Checkout extends Command {

    /**
     * Checkout a branch
     */
    async branch(repoPath, branchName) {
        return this.addon.checkoutBranch(repoPath, branchName);
    }
}

module.exports = Checkout;