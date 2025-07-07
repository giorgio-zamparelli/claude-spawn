import { execSync } from 'child_process';

export function executeCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch {
    return null;
  }
}

export function isGitRepository() {
  const result = executeCommand('git rev-parse --is-inside-work-tree');
  return result && result.trim() === 'true';
}

export function getGitRootDirectory() {
  const result = executeCommand('git rev-parse --show-toplevel');
  return result ? result.trim() : null;
}

export function getCurrentBranch() {
  const result = executeCommand('git branch --show-current');
  return result ? result.trim() : null;
}

export function getExistingBranches() {
  const result = executeCommand('git branch -a');
  if (!result) return [];

  return (
    result
      .split('\n')
      .map((branch) => {
        // Remove the current branch marker (*) and any leading/trailing spaces
        let cleanBranch = branch.replace(/^\*?\s+/, '').trim();
        // Remove any leading + or - markers (from git branch -a output)
        cleanBranch = cleanBranch.replace(/^[+-]\s+/, '');
        // Remove remote prefix if present
        cleanBranch = cleanBranch.replace(/^remotes\/origin\//, '');
        return cleanBranch;
      })
      .filter((branch) => branch && branch !== '')
      // Remove duplicates
      .filter((branch, index, self) => self.indexOf(branch) === index)
  );
}

export function getWorktrees() {
  const result = executeCommand('git worktree list --porcelain');
  if (!result) return [];

  const worktrees = [];
  const lines = result.trim().split('\n');
  let currentWorktree = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (currentWorktree.path) {
        worktrees.push(currentWorktree);
      }
      currentWorktree = { path: line.substring(9) };
    } else if (line.startsWith('HEAD ')) {
      currentWorktree.head = line.substring(5);
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring(7);
    } else if (line === 'bare') {
      currentWorktree.bare = true;
    } else if (line.startsWith('detached')) {
      currentWorktree.detached = true;
    } else if (line === 'prunable') {
      currentWorktree.prunable = true;
    } else if (line === '') {
      if (currentWorktree.path) {
        worktrees.push(currentWorktree);
        currentWorktree = {};
      }
    }
  }

  if (currentWorktree.path) {
    worktrees.push(currentWorktree);
  }

  return worktrees;
}

export function validateBranchName(name) {
  // Basic validation for git branch names
  const invalidChars = /[\s~^:?*[\\]/;
  if (invalidChars.test(name)) {
    return 'Branch name contains invalid characters';
  }
  if (
    name.startsWith('-') ||
    name.startsWith('+') ||
    name.endsWith('.') ||
    name.endsWith('.lock')
  ) {
    return 'Invalid branch name format';
  }
  if (name.includes('..') || name.includes('@{') || name.includes('\\')) {
    return 'Branch name contains invalid sequences';
  }
  return true;
}
