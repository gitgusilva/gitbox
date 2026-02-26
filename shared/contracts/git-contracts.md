# Gitbox Contracts

## status(repoPath)
Returns:
```json
[{ "path": "src/app.ts", "status": "modified" }]
```

## branches(repoPath)
Returns:
```json
[{ "name": "main", "is_head": true }]
```

## log(repoPath, maxCount)
Returns:
```json
[{ "id": "abc1234", "summary": "feat: ...", "author": "Name", "timestamp": 1735043580 }]
```

## stageAll(repoPath)
Stages all tracked/untracked changes.
Returns:
```json
true
```

## unstageAll(repoPath)
Restores index to `HEAD` tree.
Returns:
```json
true
```

## discardAll(repoPath)
Discards working tree changes (`checkout --force` semantics).
Returns:
```json
true
```

## commitAll(repoPath, message)
Creates a commit from current index and updates `HEAD`.
Returns:
```json
"<commit-sha>"
```

## checkoutBranch(repoPath, branchName)
Checks out an existing local branch.
Returns:
```json
true
```

## fetch(repoPath, remoteName = "origin")
Runs `fetch` on remote.
Returns:
```json
true
```

## pull(repoPath, remoteName = "origin")
Runs `fetch` + fast-forward pull for current branch.
Returns:
```json
true
```

## push(repoPath, remoteName = "origin")
Pushes current branch to remote.
Returns:
```json
true
```
