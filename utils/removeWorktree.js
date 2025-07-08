import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';
import executeCommand from './executeCommand.js';
import getGitRootDirectory from './getGitRootDirectory.js';
import getWorktrees from './getWorktrees.js';
import getExistingBranches from './getExistingBranches.js';
import processDiffOutput from './processDiffOutput.js';

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

export async function removeWorktree(branchName, options = {}) {
  const { forceDeleteBranch = false } = options;
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

        console.log(processDiffOutput(diffOutput, 300));

        // Also show staged changes if any
        const stagedDiff = execSync(
          `git -C "${worktree.path}" --no-pager diff --cached --color=always`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }
        );

        if (stagedDiff.trim()) {
          console.log(chalk.blue('\nStaged changes:'));
          console.log(processDiffOutput(stagedDiff, 300));
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
      // Also auto-delete if called from merge command (when no worktree exists but branch does)
      if (!userConfirmed && (worktreeRemoved || !worktree || forceDeleteBranch)) {
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
