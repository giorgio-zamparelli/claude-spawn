import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  isGitRepository,
  getGitRootDirectory,
  getCurrentBranch,
  getExistingBranches,
  getWorktrees,
  validateBranchName,
} from './utils/git.js';

function worktreeExists(worktreePath) {
  return fs.existsSync(worktreePath);
}

async function createWorktree(branchName, options) {
  if (!isGitRepository()) {
    console.error(chalk.red('Error: Not in a git repository'));
    process.exit(1);
  }

  const gitRoot = getGitRootDirectory();
  if (!gitRoot) {
    console.error(chalk.red('Error: Could not determine git root directory'));
    process.exit(1);
  }

  const repoName = path.basename(gitRoot);
  const parentDir = path.dirname(gitRoot);
  const worktreeName = `${repoName}-${branchName}`;
  const worktreePath = path.join(parentDir, worktreeName);

  // Check if worktree already exists
  if (worktreeExists(worktreePath)) {
    console.error(chalk.yellow(`Warning: Worktree already exists at ${worktreePath}`));
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Do you want to remove the existing worktree and create a new one?',
        default: false,
      },
    ]);

    if (!overwrite) {
      process.exit(1);
    }

    console.log(chalk.yellow('Removing existing worktree...'));
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, { stdio: 'inherit' });
    } catch {
      console.error(chalk.red('Failed to remove existing worktree'));
      process.exit(1);
    }
  }

  console.log(chalk.blue(`\nCreating worktree for branch '${branchName}'...`));
  console.log(chalk.gray(`Repository: ${gitRoot}`));
  console.log(chalk.gray(`Worktree path: ${worktreePath}`));

  try {
    process.chdir(parentDir);

    const gitWorktreeCommand = `git -C "${gitRoot}" worktree add "${worktreePath}" -b "${branchName}"`;
    console.log(chalk.gray(`Running: ${gitWorktreeCommand}`));

    execSync(gitWorktreeCommand, { stdio: 'inherit' });

    console.log(chalk.green(`\n✅ Worktree created successfully!`));
    console.log(chalk.blue(`Changing to worktree directory: ${worktreePath}`));

    process.chdir(worktreePath);

    // Launch editor if not disabled
    if (!options.noEditor) {
      const editor = options.editor || 'claude';
      console.log(chalk.blue(`\nLaunching ${editor}...`));
      try {
        execSync(editor, { stdio: 'inherit' });
      } catch {
        console.error(
          chalk.yellow(
            `Warning: Could not launch ${editor}. Make sure it's installed and in your PATH.`
          )
        );
      }
    }
  } catch (error) {
    console.error(chalk.red(`\nError creating worktree: ${error.message}`));
    process.exit(1);
  }
}

async function switchToWorktree(worktreePath, branchName) {
  console.log(chalk.blue(`\nSwitching to worktree: ${worktreePath}`));

  // Check if the worktree directory exists
  if (!fs.existsSync(worktreePath)) {
    console.log(chalk.yellow(`Worktree directory not found. Recreating it...`));

    // Extract branch name from the worktree info if not provided
    if (!branchName) {
      const worktrees = getWorktrees();
      const worktreeInfo = worktrees.find((wt) => wt.path === worktreePath);
      if (worktreeInfo && worktreeInfo.branch) {
        branchName = worktreeInfo.branch.replace('refs/heads/', '');
      } else {
        console.error(chalk.red(`Cannot determine branch name for worktree: ${worktreePath}`));
        process.exit(1);
      }
    }

    // Recreate the worktree
    const gitRoot = getGitRootDirectory();
    const parentDir = path.dirname(worktreePath);

    try {
      // First, remove the missing worktree registration
      console.log(chalk.gray('Removing stale worktree registration...'));
      try {
        execSync(`git worktree remove "${worktreePath}" --force`, { stdio: 'pipe' });
      } catch {
        // If remove fails, try prune
        try {
          execSync('git worktree prune', { stdio: 'pipe' });
        } catch {
          // Ignore prune errors
        }
      }

      process.chdir(parentDir);
      const gitWorktreeCommand = `git -C "${gitRoot}" worktree add "${worktreePath}" "${branchName}"`;
      console.log(chalk.gray(`Running: ${gitWorktreeCommand}`));

      execSync(gitWorktreeCommand, { stdio: 'inherit' });
      console.log(chalk.green(`✅ Worktree recreated successfully!`));
    } catch (error) {
      console.error(chalk.red(`Failed to recreate worktree: ${error.message}`));
      process.exit(1);
    }
  }

  try {
    process.chdir(worktreePath);
    console.log(chalk.green(`✅ Changed to ${worktreePath}`));

    // Launch editor
    console.log(chalk.blue(`\nLaunching claude...`));
    try {
      execSync('claude', { stdio: 'inherit' });
    } catch {
      console.error(
        chalk.yellow(`Warning: Could not launch claude. Make sure it's installed and in your PATH.`)
      );
    }
  } catch (error) {
    console.error(chalk.red(`Error switching to worktree: ${error.message}`));
    process.exit(1);
  }
}

async function createWorktreeForExistingBranch(branchName, options) {
  if (!isGitRepository()) {
    console.error(chalk.red('Error: Not in a git repository'));
    process.exit(1);
  }

  const gitRoot = getGitRootDirectory();
  if (!gitRoot) {
    console.error(chalk.red('Error: Could not determine git root directory'));
    process.exit(1);
  }

  const repoName = path.basename(gitRoot);
  const parentDir = path.dirname(gitRoot);
  const worktreeName = `${repoName}-${branchName}`;
  const worktreePath = path.join(parentDir, worktreeName);

  // Check if worktree already exists
  if (worktreeExists(worktreePath)) {
    console.error(chalk.yellow(`Warning: Worktree already exists at ${worktreePath}`));
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Do you want to remove the existing worktree and create a new one?',
        default: false,
      },
    ]);

    if (!overwrite) {
      process.exit(1);
    }

    console.log(chalk.yellow('Removing existing worktree...'));
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, { stdio: 'inherit' });
    } catch {
      console.error(chalk.red('Failed to remove existing worktree'));
      process.exit(1);
    }
  }

  console.log(chalk.blue(`\nCreating worktree for existing branch '${branchName}'...`));
  console.log(chalk.gray(`Repository: ${gitRoot}`));
  console.log(chalk.gray(`Worktree path: ${worktreePath}`));

  try {
    process.chdir(parentDir);

    // For existing branches, we don't use -b flag
    const gitWorktreeCommand = `git -C "${gitRoot}" worktree add "${worktreePath}" "${branchName}"`;
    console.log(chalk.gray(`Running: ${gitWorktreeCommand}`));

    execSync(gitWorktreeCommand, { stdio: 'inherit' });

    console.log(chalk.green(`\n✅ Worktree created successfully!`));
    console.log(chalk.blue(`Changing to worktree directory: ${worktreePath}`));

    process.chdir(worktreePath);

    // Launch editor if not disabled
    if (!options.noEditor) {
      const editor = options.editor || 'claude';
      console.log(chalk.blue(`\nLaunching ${editor}...`));
      try {
        execSync(editor, { stdio: 'inherit' });
      } catch {
        console.error(
          chalk.yellow(
            `Warning: Could not launch ${editor}. Make sure it's installed and in your PATH.`
          )
        );
      }
    }
  } catch (error) {
    console.error(chalk.red(`\nError creating worktree: ${error.message}`));
    process.exit(1);
  }
}

async function interactiveMode(options) {
  console.log(chalk.cyan.bold('\n🌳 Welcome to Git Worktree Spawner!\n'));

  const currentBranch = getCurrentBranch();
  if (currentBranch) {
    console.log(chalk.gray(`Current branch: ${chalk.white(currentBranch)}`));
  }

  // Get existing worktrees
  const worktrees = getWorktrees();
  const gitRoot = getGitRootDirectory();
  const currentPath = gitRoot;

  const existingBranches = getExistingBranches();

  // Build choices list with existing worktrees and branches
  const choices = [];

  // Add existing worktrees (except current)
  const otherWorktrees = worktrees.filter((wt) => wt.path !== currentPath);
  if (otherWorktrees.length > 0) {
    choices.push(new inquirer.Separator(chalk.gray('── Existing Worktrees ──')));
    otherWorktrees.forEach((wt) => {
      const branch = wt.branch || (wt.detached ? 'detached HEAD' : 'no branch');
      const exists = fs.existsSync(wt.path);
      const status = !exists
        ? chalk.red(' [missing]')
        : wt.prunable
          ? chalk.yellow(' [prunable]')
          : '';
      choices.push({
        name: `${chalk.blue(path.basename(wt.path))} ${chalk.gray(`(${branch})`)}${status}`,
        value: { type: 'switch', path: wt.path, branch: wt.branch },
      });
    });
  }

  // Get branches that don't have worktrees
  const worktreeBranches = worktrees.map((wt) => wt.branch).filter(Boolean);
  const branchesWithoutWorktrees = existingBranches.filter(
    (branch) => !worktreeBranches.includes(`refs/heads/${branch}`)
  );

  if (branchesWithoutWorktrees.length > 0) {
    choices.push(new inquirer.Separator(chalk.gray('── Branches Without Worktrees ──')));
    branchesWithoutWorktrees.forEach((branch) => {
      choices.push({
        name: `${chalk.yellow(branch)} ${chalk.gray('(no worktree)')}`,
        value: { type: 'create-existing', branch: branch },
      });
    });
  }

  // Add create new option
  choices.push(new inquirer.Separator(chalk.gray('── Create New ──')));
  choices.push({
    name: chalk.green('✨ Create new worktree'),
    value: { type: 'create' },
  });

  // Add separator and exit
  choices.push(new inquirer.Separator());
  choices.push({
    name: chalk.gray('Exit'),
    value: { type: 'exit' },
  });

  // Show current worktree info
  console.log(
    chalk.gray(
      `\nCurrently in: ${chalk.white(path.basename(currentPath))} ${chalk.gray(`(${currentBranch || 'no branch'})`)}}`
    )
  );

  // Ask user to select
  const { selection } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selection',
      message: 'Select a worktree or create a new one:',
      choices: choices,
      pageSize: 15,
    },
  ]);

  if (selection.type === 'exit') {
    console.log(chalk.gray('Goodbye!'));
    process.exit(0);
  }

  if (selection.type === 'switch') {
    const branchName = selection.branch ? selection.branch.replace('refs/heads/', '') : null;
    await switchToWorktree(selection.path, branchName);
    return;
  }

  if (selection.type === 'create-existing') {
    // Create worktree for existing branch
    await createWorktreeForExistingBranch(selection.branch, options);
    return;
  }

  // Create new worktree flow
  const questions = [
    {
      type: 'input',
      name: 'branchName',
      message: 'Enter the branch name for the new worktree:',
      validate: validateBranchName,
      when: () => !options.fromExisting,
    },
    {
      type: 'list',
      name: 'branchName',
      message: 'Select an existing branch:',
      choices: existingBranches,
      when: () => options.fromExisting && existingBranches.length > 0,
    },
  ];

  const answers = await inquirer.prompt(questions);

  await createWorktree(answers.branchName, options);
}

export async function addCommand(branchName, options) {
  if (branchName) {
    // Validate branch name
    const validation = validateBranchName(branchName);
    if (validation !== true) {
      console.error(chalk.red(`Error: ${validation}`));
      process.exit(1);
    }
    await createWorktree(branchName, options);
  } else {
    // Interactive mode
    await interactiveMode(options);
  }
}

export function createAddCommand(program) {
  program
    .argument('[branch-name]', 'Name of the branch to create')
    .option('-e, --editor <editor>', 'Editor to launch (default: claude)')
    .option('-n, --no-editor', 'Do not launch any editor')
    .option('-x, --from-existing', 'Choose from existing branches')
    .action(async (branchName, options) => {
      // Check if the branch name is actually a subcommand
      const subcommands = program.commands.map((cmd) => cmd.name());
      if (branchName && subcommands.includes(branchName)) {
        // This is a subcommand, not a branch name - let commander handle it
        return;
      }
      await addCommand(branchName, options);
    });
}
