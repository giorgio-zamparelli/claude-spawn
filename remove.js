import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';
import isGitRepository from './utils/isGitRepository.js';
import getGitRootDirectory from './utils/getGitRootDirectory.js';
import getWorktrees from './utils/getWorktrees.js';
import getExistingBranches from './utils/getExistingBranches.js';
import { removeWorktree } from './utils/removeWorktree.js';

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
