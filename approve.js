import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import isGitRepository from './utils/isGitRepository.js';
import getGitRootDirectory from './utils/getGitRootDirectory.js';
import getCurrentBranch from './utils/getCurrentBranch.js';

function hasUncommittedChanges() {
  try {
    const result = execSync('git status --porcelain', { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function getMainBranch() {
  try {
    // Try to get the default branch from remote
    const result = execSync('git symbolic-ref refs/remotes/origin/HEAD --short', {
      encoding: 'utf8',
    });
    return result.trim().replace('origin/', '');
  } catch {
    // Fallback to checking if main or master exists
    try {
      execSync('git show-ref --verify refs/heads/main', { encoding: 'utf8' });
      return 'main';
    } catch {
      try {
        execSync('git show-ref --verify refs/heads/master', { encoding: 'utf8' });
        return 'master';
      } catch {
        return 'main'; // Default to main
      }
    }
  }
}

export async function approveCommand() {
  if (!isGitRepository()) {
    console.error(chalk.red('Error: Not in a git repository'));
    process.exit(1);
  }

  const currentBranch = getCurrentBranch();
  if (!currentBranch) {
    console.error(chalk.red('Error: Could not determine current branch'));
    process.exit(1);
  }

  const mainBranch = getMainBranch();

  // Check if we're on main/master
  if (currentBranch === 'main' || currentBranch === 'master') {
    console.error(chalk.red(`Error: Cannot run approve from the '${currentBranch}' branch`));
    console.log(chalk.yellow('Please run this command from a feature branch'));
    process.exit(1);
  }

  // Check for uncommitted changes
  if (hasUncommittedChanges()) {
    console.error(chalk.red('Error: You have uncommitted changes'));
    console.log(chalk.yellow('Please commit or stash your changes before approving'));

    // Show status
    console.log(chalk.gray('\nCurrent status:'));
    execSync('git status --short', { stdio: 'inherit' });
    process.exit(1);
  }

  console.log(chalk.cyan.bold('\n✅ Approving branch for merge to main\n'));
  console.log(chalk.gray(`Current branch: ${chalk.white(currentBranch)}`));
  console.log(chalk.gray(`Target branch: ${chalk.white(mainBranch)}`));

  const gitRoot = getGitRootDirectory();
  const currentDirName = path.basename(gitRoot);
  const parentDir = path.dirname(gitRoot);

  // Extract the base repo name by removing the branch suffix
  // If we're in 'waiterio-stiloso-testing', the base repo name is 'waiterio'
  let repoName = currentDirName;

  // Check if this is a worktree with branch suffix
  if (currentDirName.includes('-') && currentDirName !== currentBranch) {
    // Try to find the base repo name by checking what exists
    const parts = currentDirName.split('-');

    // Try different combinations to find the main worktree
    for (let i = 1; i <= parts.length; i++) {
      const possibleRepoName = parts.slice(0, i).join('-');
      const possibleMainPath = path.join(parentDir, possibleRepoName);

      if (fs.existsSync(possibleMainPath) && fs.statSync(possibleMainPath).isDirectory()) {
        // Verify it's a git repository
        try {
          execSync('git rev-parse --git-dir', {
            cwd: possibleMainPath,
            stdio: 'pipe',
          });
          repoName = possibleRepoName;
          break;
        } catch {
          // Not a git repo, continue searching
        }
      }
    }
  }

  const mainWorktreePath = path.join(parentDir, repoName);

  // Check if main worktree exists
  if (!fs.existsSync(mainWorktreePath)) {
    console.error(chalk.red(`Error: Main worktree not found at ${mainWorktreePath}`));
    console.log(chalk.yellow(`Expected to find the main branch worktree at: ${mainWorktreePath}`));
    console.log(
      chalk.yellow(
        'Please ensure you have a worktree for the main branch with the standard naming convention'
      )
    );
    process.exit(1);
  }

  try {
    // Save current directory
    const originalDir = process.cwd();

    console.log(chalk.blue(`\nSwitching to main worktree: ${mainWorktreePath}`));
    process.chdir(mainWorktreePath);

    // Verify we're on the main branch
    const mainWorktreeBranch = getCurrentBranch();
    if (mainWorktreeBranch !== mainBranch) {
      console.error(
        chalk.red(`Error: The worktree at ${mainWorktreePath} is not on the '${mainBranch}' branch`)
      );
      console.log(chalk.yellow(`Found branch: ${mainWorktreeBranch}`));
      process.exit(1);
    }

    // Pull latest changes
    console.log(chalk.blue('\nPulling latest changes from origin...'));
    try {
      execSync(`git pull origin ${mainBranch}`, { stdio: 'inherit' });
    } catch (error) {
      console.error(chalk.red('Failed to pull latest changes'));
      throw error;
    }

    // Merge the feature branch
    console.log(chalk.blue(`\nMerging '${currentBranch}' into '${mainBranch}'...`));
    try {
      execSync(`git merge ${currentBranch} --no-edit`, { stdio: 'inherit' });
    } catch (error) {
      if (error.status === 1 && error.toString().includes('CONFLICT')) {
        console.error(chalk.red('\n❌ Merge conflict detected!'));
        console.log(chalk.yellow('\nPlease resolve conflicts manually in the main worktree:'));
        console.log(chalk.gray(`cd ${mainWorktreePath}`));
        console.log(chalk.gray('# Fix conflicts, then:'));
        console.log(chalk.gray('git add <resolved-files>'));
        console.log(chalk.gray('git commit'));
        console.log(chalk.gray('git push origin ' + mainBranch));

        // Return to original directory
        process.chdir(originalDir);
        process.exit(1);
      }
      throw error;
    }

    // Push to origin
    console.log(chalk.blue('\nPushing to origin...'));
    try {
      execSync(`git push origin ${mainBranch}`, { stdio: 'inherit' });
    } catch (error) {
      console.error(chalk.red('Failed to push to origin'));
      throw error;
    }

    console.log(
      chalk.green(`\n✅ Successfully approved and merged '${currentBranch}' into '${mainBranch}'!`)
    );

    // Return to original directory
    process.chdir(originalDir);
    console.log(chalk.gray(`\nReturned to: ${originalDir}`));

    // Suggest next steps
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.gray(`1. Delete the local branch: git branch -d ${currentBranch}`));
    console.log(chalk.gray(`2. Remove this worktree: spawn remove ${currentBranch}`));
  } catch (error) {
    console.error(chalk.red(`\nError during approval: ${error.message}`));
    process.exit(1);
  }
}

export function createApproveCommand(program) {
  program
    .command('approve')
    .description('Merge current branch into main and push (must not be on main/master)')
    .action(async () => {
      await approveCommand();
    });
}
