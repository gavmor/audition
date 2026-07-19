# Fork Maintenance Strategy

This repository is a long-running fork of `benchristel/audition`. Because we want to continually pull in upstream updates while building out our own independent feature stack, we strictly adhere to a highly isolated branching and deployment workflow.

## The Golden Rule

**Never commit directly to `main`.**

The `main` branch is strictly a pristine, read-only mirror of `upstream/main`. It guarantees we always have a clean baseline to branch from or revert to.

## Day-to-Day Workflow

### 1. Creating a New Feature

All new features are developed in total isolation. Always branch directly from `main` unless the new feature explicitly depends on another unmerged feature branch.

```bash
# Start from the pristine mirror
git checkout main

# Cut a new isolated branch
git checkout -b feat-my-new-thing
```

### 2. Testing and Deploying (`dev-combined`)

We never deploy or test isolated features alone. Instead, we use a single integration branch called `dev-combined`. 

**`dev-combined` is strictly an end-of-the-line destination.** You merge features *into* it, but you never branch *from* it. If a feature branches from `dev-combined`, it inherits every other unmerged feature, ruining its isolation.

To test your new feature:
```bash
# Switch to the integration branch
git checkout dev-combined

# Merge your isolated feature IN for local testing or production deployment
git merge feat-my-new-thing
```

### 3. Syncing with Upstream

When `benchristel/audition` pushes a major update, we rebuild our stack:

1. Update the `main` mirror (`git fetch upstream && git rebase upstream/main`).
2. Rebase all active feature branches onto the new `main`.
3. Blow away the old integration branch (`git branch -D dev-combined`).
4. Recreate `dev-combined` from `main` and merge all rebased feature branches back in.

## Resolving Structural Conflicts (`git rerere`)

Because `dev-combined` is frequently destroyed and rebuilt, you will repeatedly encounter the same structural merge conflicts when merging certain divergent features together. 

To save time, we rely on **git rerere** (Reuse Recorded Resolution).

Ensure it is enabled locally:
```bash
git config rerere.enabled true
```

With `rerere` enabled, Git will silently memorize how you resolve conflicts when merging into `dev-combined`. The next time you rebuild `dev-combined` and merge those same branches, Git will automatically apply your recorded conflict resolutions.
