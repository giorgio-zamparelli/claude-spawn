import { execSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  isGitRepository,
  getGitRootDirectory,
  getCurrentBranch,
  getExistingBranches,
  getWorktrees,
} from './utils/git.js';
import { removeWorktree } from './remove.js';

function hasUncommittedChanges() {
  try {
    const result = execSync('git status --porcelain', { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function getBranchAheadBehind(branch, baseBranch) {
  try {
    const result = execSync(`git rev-list --left-right --count ${baseBranch}...${branch}`, {
      encoding: 'utf8',
    });
    const [behind, ahead] = result.trim().split('\t').map(Number);
    return { ahead, behind };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

async function performMerge(branchName, currentBranch) {
  console.log(
    chalk.blue(`\nMerging ${chalk.white(branchName)} into ${chalk.white(currentBranch)}...\n`)
  );

  try {
    // Check if the branch exists
    const branches = getExistingBranches();
    if (!branches.includes(branchName)) {
      console.error(chalk.red(`Error: Branch '${branchName}' does not exist`));
      return false;
    }

    // Check for uncommitted changes
    if (hasUncommittedChanges()) {
      console.error(chalk.red('Error: You have uncommitted changes.'));
      console.log(chalk.yellow('Please commit or stash your changes before merging.'));

      // Show status
      console.log(chalk.gray('\nCurrent status:'));
      execSync('git status --short', { stdio: 'inherit' });
      return false;
    }

    // Show what will be merged
    const { ahead } = getBranchAheadBehind(branchName, currentBranch);
    if (ahead === 0) {
      console.log(chalk.yellow(`Branch '${branchName}' has no new commits to merge.`));
      return true;
    }

    console.log(
      chalk.gray(`Branch '${branchName}' is ${ahead} commit(s) ahead of '${currentBranch}'.`)
    );

    // Show preview of commits to be merged
    console.log(chalk.blue('\nCommits to be merged:'));
    execSync(`git --no-pager log --oneline --color=always ${currentBranch}..${branchName}`, {
      stdio: 'inherit',
    });

    // Show file changes summary
    console.log(chalk.blue('\nFiles to be changed:'));
    execSync(`git --no-pager diff --stat --color=always ${currentBranch}...${branchName}`, {
      stdio: 'inherit',
    });

    // Show actual diff (limited to prevent overwhelming output)
    console.log(chalk.blue('\nChanges preview:'));
    try {
      // Get diff with context limited to 3 lines and no more than 500 lines total
      const diffOutput = execSync(
        `git --no-pager diff --color=always --unified=3 ${currentBranch}...${branchName}`,
        { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
      );

      const lines = diffOutput.split('\n');
      if (lines.length > 500) {
        // Show first 500 lines and indicate truncation
        console.log(lines.slice(0, 500).join('\n'));
        console.log(chalk.yellow(`\n... diff truncated (${lines.length - 500} more lines) ...`));
      } else {
        console.log(diffOutput);
      }
    } catch {
      console.log(chalk.yellow('Could not generate diff preview'));
    }

    // Confirm merge
    const { confirmMerge } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmMerge',
        message: `Do you want to merge '${branchName}' into '${currentBranch}'?`,
        default: true,
      },
    ]);

    if (!confirmMerge) {
      console.log(chalk.gray('Merge cancelled.'));
      return false;
    }

    // Perform the merge with automatic commit message
    console.log(chalk.yellow('\nPerforming merge...'));
    const mergeMessage = `Merge branch '${branchName}' into ${currentBranch}`;
    execSync(`git merge ${branchName} -m "${mergeMessage}"`, { stdio: 'inherit' });

    console.log(chalk.green(`\n✅ Successfully merged '${branchName}' into '${currentBranch}'`));

    // Show merge summary
    console.log(chalk.blue('\nMerge summary:'));
    execSync('git --no-pager log --oneline --color=always -1', { stdio: 'inherit' });

    // Ask if user wants to remove the merged branch/worktree
    const { removeBranch } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'removeBranch',
        message: `Do you want to remove the branch '${branchName}' and its worktree?`,
        default: true,
      },
    ]);

    if (removeBranch) {
      console.log(chalk.yellow(`\nRemoving branch '${branchName}' and its worktree...`));
      await removeWorktree(branchName);
    }

    return true;
  } catch (error) {
    if (error.status === 1 && error.stdout && error.stdout.includes('CONFLICT')) {
      console.error(chalk.red('\n❌ Merge conflict detected!'));
      console.log(chalk.yellow('\nTo resolve:'));
      console.log(chalk.gray('1. Fix the conflicts in the listed files'));
      console.log(chalk.gray('2. Stage the resolved files: git add <file>'));
      console.log(chalk.gray('3. Complete the merge: git commit'));
      console.log(chalk.gray('4. Or abort the merge: git merge --abort'));

      // Show conflicted files
      console.log(chalk.red('\nConflicted files:'));
      try {
        execSync('git diff --name-only --diff-filter=U', { stdio: 'inherit' });
      } catch {
        // Ignore error
      }
    } else {
      console.error(chalk.red(`\nError during merge: ${error.message}`));
    }
    return false;
  }
}

async function interactiveMerge() {
  console.log(chalk.cyan.bold('\n🔀 Git Merge Tool\n'));

  const currentBranch = getCurrentBranch();
  if (!currentBranch) {
    console.error(chalk.red('Error: Could not determine current branch'));
    return;
  }

  console.log(chalk.gray(`Current branch: ${chalk.white(currentBranch)}`));

  // Get all branches except current
  const branches = getExistingBranches().filter((branch) => branch !== currentBranch);

  if (branches.length === 0) {
    console.log(chalk.yellow('No other branches available to merge.'));
    return;
  }

  // Get worktrees for additional context
  const worktrees = getWorktrees();
  const gitRoot = getGitRootDirectory();

  // Build choices with branch info
  const choices = branches.map((branch) => {
    const worktree = worktrees.find(
      (wt) => wt.branch && wt.branch.replace('refs/heads/', '') === branch
    );

    const { ahead, behind } = getBranchAheadBehind(branch, currentBranch);

    let name = chalk.yellow(branch);

    // Add ahead/behind info
    if (ahead > 0 || behind > 0) {
      const status = [];
      if (ahead > 0) status.push(chalk.green(`↑${ahead}`));
      if (behind > 0) status.push(chalk.red(`↓${behind}`));
      name += chalk.gray(` (${status.join(' ')})`);
    }

    // Add worktree info
    if (worktree && worktree.path !== gitRoot) {
      name += chalk.gray(` [${path.basename(worktree.path)}]`);
    }

    return {
      name,
      value: branch,
    };
  });

  // Sort by branches with commits to merge first
  choices.sort((a, b) => {
    const aMatch = a.name.match(/↑(\d+)/);
    const bMatch = b.name.match(/↑(\d+)/);
    const aAhead = aMatch ? parseInt(aMatch[1]) : 0;
    const bAhead = bMatch ? parseInt(bMatch[1]) : 0;
    return bAhead - aAhead;
  });

  // Add separator and cancel option
  choices.push(new inquirer.Separator());
  choices.push({
    name: chalk.gray('Cancel'),
    value: null,
  });

  const { selectedBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBranch',
      message: 'Select a branch to merge into current branch:',
      choices: choices,
      pageSize: 15,
    },
  ]);

  if (!selectedBranch) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  await performMerge(selectedBranch, currentBranch);
}

export async function mergeCommand(branchName) {
  if (!isGitRepository()) {
    console.error(chalk.red('Error: Not in a git repository'));
    process.exit(1);
  }

  const currentBranch = getCurrentBranch();
  if (!currentBranch) {
    console.error(chalk.red('Error: Could not determine current branch'));
    process.exit(1);
  }

  if (branchName) {
    // Direct merge mode
    await performMerge(branchName, currentBranch);
  } else {
    // Interactive mode
    await interactiveMerge();
  }
}

export function createMergeCommand(program) {
  program
    .command('merge [branch-name]')
    .description('Merge another branch into the current branch')
    .action(async (branchName) => {
      await mergeCommand(branchName);
    });
}
