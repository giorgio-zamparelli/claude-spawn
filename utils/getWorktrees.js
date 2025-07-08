import executeCommand from './executeCommand.js';

export default function getWorktrees() {
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
