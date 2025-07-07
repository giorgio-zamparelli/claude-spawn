import { execSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';

// Utility functions
function executeCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch {
    return null;
  }
}

function isGitRepository() {
  const result = executeCommand('git rev-parse --is-inside-work-tree');
  return result && result.trim() === 'true';
}

function getGitRootDirectory() {
  const result = executeCommand('git rev-parse --show-toplevel');
  return result ? result.trim() : null;
}

function getWorktrees() {
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

export async function listWorktrees() {
  if (!isGitRepository()) {
    console.error(chalk.red('Error: Not in a git repository'));
    process.exit(1);
  }

  const worktrees = getWorktrees();
  const gitRoot = getGitRootDirectory();

  console.log(chalk.cyan.bold('\n🌳 Git Worktrees:\n'));

  if (worktrees.length === 0) {
    console.log(chalk.yellow('No worktrees found.'));
  } else {
    worktrees.forEach((wt, index) => {
      const isCurrent = wt.path === gitRoot;
      const branch =
        wt.branch || (wt.detached ? chalk.yellow('detached HEAD') : chalk.gray('no branch'));
      const marker = isCurrent ? chalk.green(' ← current') : '';

      console.log(chalk.white(`${index + 1}. ${chalk.bold(path.basename(wt.path))}`));
      console.log(chalk.gray(`   Path: ${wt.path}`));
      console.log(chalk.gray(`   Branch: ${branch}${marker}`));
      console.log();
    });
  }
}

export function createListCommand(program) {
  program
    .command('list')
    .description('List all worktrees')
    .action(async () => {
      await listWorktrees();
    });
}
