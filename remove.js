import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  executeCommand,
  isGitRepository,
  getGitRootDirectory,
  getWorktrees,
  getExistingBranches,
} from './utils/git.js';

function hasUncommittedChanges(worktreePath) {
  try {
    const result = execSync(`git -C "${worktreePath}" status --porcelain`, { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function hasUnmergedCommits(branchName) {
  try {
    // Check if branch has commits not merged to main/master
    const mainBranch =
      executeCommand('git symbolic-ref refs/remotes/origin/HEAD --short')
        ?.trim()
        .replace('origin/', '') || 'main';
    const result = execSync(`git log ${mainBranch}..${branchName} --oneline`, { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch {
    // If the command fails, assume there might be unmerged commits
    return true;
  }
}

export async function removeWorktree(branchName) {
  const worktrees = getWorktrees();
  const gitRoot = getGitRootDirectory();
  const repoName = path.basename(gitRoot);

  // Find worktree for this branch
  const worktree = worktrees.find((wt) => {
    const wtBranch = wt.branch ? wt.branch.replace('refs/heads/', '') : null;
    return wtBranch === branchName || path.basename(wt.path) === `${repoName}-${branchName}`;
  });

  let worktreeRemoved = false;

  if (worktree) {
    // Check if this is the current worktree
    if (worktree.path === gitRoot) {
      console.error(chalk.red('Error: Cannot remove the current worktree'));
      process.exit(1);
    }

    // Check for uncommitted changes
    if (fs.existsSync(worktree.path) && hasUncommittedChanges(worktree.path)) {
      console.log(chalk.yellow(`\nWorktree has uncommitted changes at ${worktree.path}`));

      // Show uncommitted files
      console.log(chalk.blue('\nUncommitted files:'));
      try {
        execSync(`git -C "${worktree.path}" status --short`, { stdio: 'inherit' });
      } catch {
        console.log(chalk.gray('Could not retrieve file list'));
      }

      // Show diff without pager
      console.log(chalk.blue('\nUncommitted changes:'));
      try {
        const diffOutput = execSync(
          `git -C "${worktree.path}" --no-pager diff --color=always`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
        );

        const lines = diffOutput.split('\n');
        if (lines.length > 300) {
          // Show first 300 lines and indicate truncation
          console.log(lines.slice(0, 300).join('\n'));
          console.log(chalk.yellow(`\n... diff truncated (${lines.length - 300} more lines) ...`));
        } else {
          console.log(diffOutput || chalk.gray('No unstaged changes'));
        }

        // Also show staged changes if any
        const stagedDiff = execSync(
          `git -C "${worktree.path}" --no-pager diff --cached --color=always`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }
        );

        if (stagedDiff.trim()) {
          console.log(chalk.blue('\nStaged changes:'));
          const stagedLines = stagedDiff.split('\n');
          if (stagedLines.length > 300) {
            console.log(stagedLines.slice(0, 300).join('\n'));
            console.log(
              chalk.yellow(`\n... diff truncated (${stagedLines.length - 300} more lines) ...`)
            );
          } else {
            console.log(stagedDiff);
          }
        }
      } catch {
        console.log(chalk.gray('Could not generate diff'));
      }

      // Ask if user wants to force remove
      const { forceRemove } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'forceRemove',
          message: chalk.red(
            'Do you want to delete these uncommitted changes and remove the worktree anyway?'
          ),
          default: false,
        },
      ]);

      if (!forceRemove) {
        console.log(chalk.gray('Removal cancelled.'));
        return false;
      }
    }

    console.log(chalk.yellow(`Removing worktree at ${worktree.path}...`));
    try {
      execSync(`git worktree remove "${worktree.path}" --force`, { stdio: 'inherit' });
      console.log(chalk.green('✅ Worktree removed successfully'));
      worktreeRemoved = true;
    } catch (error) {
      console.error(chalk.red(`Failed to remove worktree: ${error.message}`));
      return false;
    }
  }

  // Check if the branch exists
  const branches = getExistingBranches();
  if (branches.includes(branchName)) {
    let shouldDeleteBranch = true;
    let userConfirmed = false;

    // Check for unmerged commits
    if (hasUnmergedCommits(branchName)) {
      console.log(chalk.yellow(`\nBranch '${branchName}' has unmerged commits.`));
      const { confirmDelete } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: `Do you still want to delete the branch '${branchName}'?`,
          default: false,
        },
      ]);
      shouldDeleteBranch = confirmDelete;
      userConfirmed = true;
    }

    if (shouldDeleteBranch) {
      // If we haven't asked the user yet and worktree was removed, auto-delete
      if (!userConfirmed && worktreeRemoved) {
        console.log(chalk.yellow(`Automatically deleting branch ${branchName}...`));
      } else if (!userConfirmed) {
        // Only ask if we haven't already asked about unmerged commits
        const { removeBranch } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'removeBranch',
            message: `Do you also want to delete the branch '${branchName}'?`,
            default: true,
          },
        ]);
        shouldDeleteBranch = removeBranch;
      }

      if (shouldDeleteBranch) {
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
  } else if (!worktree) {
    // Neither worktree nor branch exists
    console.log(chalk.yellow(`No worktree or branch found with name '${branchName}'`));
    return false;
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
