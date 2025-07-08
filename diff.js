import { execSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import isGitRepository from './utils/isGitRepository.js';
import getGitRootDirectory from './utils/getGitRootDirectory.js';
import getCurrentBranch from './utils/getCurrentBranch.js';
import getExistingBranches from './utils/getExistingBranches.js';
import getWorktrees from './utils/getWorktrees.js';

function runGitDiff(branchName, currentBranch) {
  console.log(
    chalk.blue(
      `\nShowing diff between ${chalk.white(currentBranch)} and ${chalk.white(branchName)}:\n`
    )
  );

  try {
    // Check if the branch exists
    const branches = getExistingBranches();
    if (!branches.includes(branchName)) {
      console.error(chalk.red(`Error: Branch '${branchName}' does not exist`));
      return false;
    }

    // Run git diff with color output
    execSync(`git diff ${currentBranch}...${branchName}`, {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    // Also show a summary
    console.log(chalk.gray('\n─────────────────────────────────────────'));
    console.log(chalk.blue('Summary:'));
    const stats = execSync(`git diff ${currentBranch}...${branchName} --stat`, {
      encoding: 'utf8',
    });
    console.log(stats);

    return true;
  } catch (error) {
    console.error(chalk.red(`Error running diff: ${error.message}`));
    return false;
  }
}

async function interactiveDiff() {
  console.log(chalk.cyan.bold('\n🔍 Git Diff Tool\n'));

  const currentBranch = getCurrentBranch();
  if (!currentBranch) {
    console.error(chalk.red('Error: Could not determine current branch'));
    return;
  }

  console.log(chalk.gray(`Current branch: ${chalk.white(currentBranch)}`));

  // Get all branches except current
  const branches = getExistingBranches().filter((branch) => branch !== currentBranch);

  if (branches.length === 0) {
    console.log(chalk.yellow('No other branches available to compare.'));
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

    let name = chalk.yellow(branch);
    if (worktree) {
      const isCurrentWorktree = worktree.path === gitRoot;
      if (isCurrentWorktree) {
        name += chalk.gray(' (current worktree)');
      } else {
        name += chalk.gray(` (${path.basename(worktree.path)})`);
      }
    }

    return {
      name,
      value: branch,
    };
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
      message: 'Select a branch to compare with:',
      choices: choices,
      pageSize: 15,
    },
  ]);

  if (!selectedBranch) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  await runGitDiff(selectedBranch, currentBranch);
}

export async function diffCommand(branchName) {
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
    // Direct diff mode
    await runGitDiff(branchName, currentBranch);
  } else {
    // Interactive mode
    await interactiveDiff();
  }
}

export function createDiffCommand(program) {
  program
    .command('diff [branch-name]')
    .description('Show differences between current branch and another branch')
    .action(async (branchName) => {
      await diffCommand(branchName);
    });
}
