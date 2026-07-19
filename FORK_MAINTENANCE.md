# Fork Maintenance Strategy

This repository is a long-running fork of `benchristel/audition`. Because we want to continually pull in upstream updates while building out our own independent feature stack, we strictly adhere to a highly isolated branching and deployment workflow.

## The Golden Rule

**Never commit directly to `main`.**

The `main` branch is strictly a pristine, read-only mirror of `upstream/main`. It guarantees we always have a clean baseline to branch from or revert to.

## Day-to-Day Workflow

### 1. Establishing the Epic Baseline

Because we maintain a major structural rewrite of the CLI tooling, `main` is no longer sufficient as our daily baseline. Instead, we use `feat-core-updates` (our epic branch) as the "floating baseline." This branch holds the new architectural reality of our application.

### 2. Creating a New Feature

All new features must be cut directly from the epic branch (`feat-core-updates`), not `main`. This ensures new work has access to the updated architecture.

```bash
# Start from the new foundational epic branch
git checkout feat-core-updates

# Cut a new isolated feature branch
git checkout -b feat-my-new-thing
```

### 3. Testing and Deploying (`dev-combined`)

We never deploy or test isolated features alone. Instead, we use a single integration branch called `dev-combined`. 

**`dev-combined` is strictly an end-of-the-line destination.** You merge features *into* it, but you never branch *from* it. If a feature branches from `dev-combined`, it inherits every other unmerged feature, ruining its isolation.

To test your new feature:
```bash
# Switch to the integration branch
git checkout dev-combined

# Merge your isolated feature IN for local testing or production deployment
git merge feat-my-new-thing
```

### 4. The Chained Sync Routine

When the upstream repository pushes a major update, we perform a cascading rebase:

1. **Sync the Mirror:** Update your pristine `main` directly from `upstream/main`.
2. **Rebase the Epic:** Check out `feat-core-updates` and rebase it onto `main`. Resolve any heavy structural conflicts here (which `git rerere` will record).
3. **Rebase the Features:** Check out your active feature branches (like `feat-my-new-thing`) and rebase them onto the newly updated `feat-core-updates`.
4. **Rebuild Integration:** Recreate your throwaway `dev-combined` branch starting from `feat-core-updates`, then merge your feature branches in for testing.

This creates a clean, linear hierarchy: `main` -> `feat-core-updates` -> `isolated-features`.

## Resolving Structural Conflicts (`git rerere`)

Because `dev-combined` is frequently destroyed and rebuilt, you will repeatedly encounter the same structural merge conflicts when merging certain divergent features together. 

To save time, we rely on **git rerere** (Reuse Recorded Resolution).

Ensure it is enabled locally:
```bash
git config rerere.enabled true
```

With `rerere` enabled, Git will silently memorize how you resolve conflicts when merging into `dev-combined`. The next time you rebuild `dev-combined` and merge those same branches, Git will automatically apply your recorded conflict resolutions.
