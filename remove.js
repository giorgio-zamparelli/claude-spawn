import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';

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

function getExistingBranches() {
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

async function removeWorktree(branchName) {
  const worktrees = getWorktrees();
  const gitRoot = getGitRootDirectory();
  const repoName = path.basename(gitRoot);

  // Find worktree for this branch
  const worktree = worktrees.find((wt) => {
    const wtBranch = wt.branch ? wt.branch.replace('refs/heads/', '') : null;
    return wtBranch === branchName || path.basename(wt.path) === `${repoName}-${branchName}`;
  });

  if (worktree) {
    // Check if this is the current worktree
    if (worktree.path === gitRoot) {
      console.error(chalk.red('Error: Cannot remove the current worktree'));
      process.exit(1);
    }

    console.log(chalk.yellow(`Removing worktree at ${worktree.path}...`));
    try {
      execSync(`git worktree remove "${worktree.path}" --force`, { stdio: 'inherit' });
      console.log(chalk.green('✅ Worktree removed successfully'));
    } catch (error) {
      console.error(chalk.red(`Failed to remove worktree: ${error.message}`));
      return false;
    }
  }

  // Check if the branch exists
  const branches = getExistingBranches();
  if (branches.includes(branchName)) {
    const { removeBranch } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'removeBranch',
        message: `Do you also want to delete the branch '${branchName}'?`,
        default: true,
      },
    ]);

    if (removeBranch) {
      console.log(chalk.yellow(`Deleting branch ${branchName}...`));
      try {
        execSync(`git branch -D "${branchName}"`, { stdio: 'inherit' });
        console.log(chalk.green('✅ Branch deleted successfully'));
      } catch (error) {
        console.error(chalk.red(`Failed to delete branch: ${error.message}`));
        return false;
      }
    }
  }

  return true;
}

async function interactiveRemove() {
  const worktrees = getWorktrees();
  const gitRoot = getGitRootDirectory();
  const currentPath = gitRoot;

  // Filter out the current worktree
  const removableWorktrees = worktrees.filter((wt) => wt.path !== currentPath);

  if (removableWorktrees.length === 0) {
    console.log(chalk.yellow('No worktrees available to remove.'));
    return;
  }

  // Get branches without worktrees
  const worktreeBranches = worktrees.map((wt) => wt.branch).filter(Boolean);
  const branches = getExistingBranches();
  const branchesWithoutWorktrees = branches.filter(
    (branch) =>
      !worktreeBranches.includes(`refs/heads/${branch}`) && branch !== 'main' && branch !== 'master'
  );

  const choices = [];

  // Add existing worktrees
  choices.push(new inquirer.Separator(chalk.gray('── Worktrees ──')));
  removableWorktrees.forEach((wt) => {
    const branch = wt.branch
      ? wt.branch.replace('refs/heads/', '')
      : wt.detached
        ? 'detached HEAD'
        : 'no branch';
    const exists = fs.existsSync(wt.path);
    const status = !exists
      ? chalk.red(' [missing]')
      : wt.prunable
        ? chalk.yellow(' [prunable]')
        : '';
    choices.push({
      name: `${chalk.blue(path.basename(wt.path))} ${chalk.gray(`(${branch})`)}${status}`,
      value: branch,
    });
  });

  // Add branches without worktrees
  if (branchesWithoutWorktrees.length > 0) {
    choices.push(new inquirer.Separator(chalk.gray('── Branches Without Worktrees ──')));
    branchesWithoutWorktrees.forEach((branch) => {
      choices.push({
        name: `${chalk.yellow(branch)} ${chalk.gray('(branch only)')}`,
        value: branch,
      });
    });
  }

  // Add cancel option
  choices.push(new inquirer.Separator());
  choices.push({
    name: chalk.gray('Cancel'),
    value: null,
  });

  const { selection } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selection',
      message: 'Select a worktree or branch to remove:',
      choices: choices,
      pageSize: 15,
    },
  ]);

  if (!selection) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  await removeWorktree(selection);
}

export async function removeCommand(branchName) {
  if (!isGitRepository()) {
    console.error(chalk.red('Error: Not in a git repository'));
    process.exit(1);
  }

  if (branchName) {
    // Direct removal mode
    await removeWorktree(branchName);
  } else {
    // Interactive mode
    await interactiveRemove();
  }
}

export function createRemoveCommand(program) {
  program
    .command('remove [branch-name]')
    .description('Remove a worktree and optionally its branch')
    .action(async (branchName) => {
      await removeCommand(branchName);
    });
}
