#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { program } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';

// Utility functions
function executeCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch (error) {
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

function getCurrentBranch() {
  const result = executeCommand('git branch --show-current');
  return result ? result.trim() : null;
}

function getExistingBranches() {
  const result = executeCommand('git branch -a');
  if (!result) return [];
  
  return result.split('\n')
    .map(branch => branch.trim())
    .filter(branch => branch && !branch.startsWith('*'))
    .map(branch => branch.replace(/^remotes\/origin\//, ''));
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

function validateBranchName(name) {
  // Basic validation for git branch names
  const invalidChars = /[\s~^:?*\[\\]/;
  if (invalidChars.test(name)) {
    return 'Branch name contains invalid characters';
  }
  if (name.startsWith('-') || name.endsWith('.') || name.endsWith('.lock')) {
    return 'Invalid branch name format';
  }
  return true;
}

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
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const worktreeName = `${timestamp}-${branchName}`;
  const worktreePath = path.join(parentDir, worktreeName);

  // Check if worktree already exists
  if (worktreeExists(worktreePath)) {
    console.error(chalk.yellow(`Warning: Worktree already exists at ${worktreePath}`));
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: 'Do you want to remove the existing worktree and create a new one?',
      default: false
    }]);
    
    if (!overwrite) {
      process.exit(1);
    }
    
    console.log(chalk.yellow('Removing existing worktree...'));
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, { stdio: 'inherit' });
    } catch (error) {
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
      } catch (error) {
        console.error(chalk.yellow(`Warning: Could not launch ${editor}. Make sure it's installed and in your PATH.`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red(`\nError creating worktree: ${error.message}`));
    process.exit(1);
  }
}

async function switchToWorktree(worktreePath) {
  console.log(chalk.blue(`\nSwitching to worktree: ${worktreePath}`));
  
  try {
    process.chdir(worktreePath);
    console.log(chalk.green(`✅ Changed to ${worktreePath}`));
    
    // Launch editor
    console.log(chalk.blue(`\nLaunching claude...`));
    try {
      execSync('claude', { stdio: 'inherit' });
    } catch (error) {
      console.error(chalk.yellow(`Warning: Could not launch claude. Make sure it's installed and in your PATH.`));
    }
  } catch (error) {
    console.error(chalk.red(`Error switching to worktree: ${error.message}`));
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
  
  // Build choices list with existing worktrees and create new option
  const choices = [];
  
  // Add existing worktrees (except current)
  const otherWorktrees = worktrees.filter(wt => wt.path !== currentPath);
  if (otherWorktrees.length > 0) {
    choices.push(new inquirer.Separator(chalk.gray('── Existing Worktrees ──')));
    otherWorktrees.forEach(wt => {
      const branch = wt.branch || (wt.detached ? 'detached HEAD' : 'no branch');
      choices.push({
        name: `${chalk.blue(path.basename(wt.path))} ${chalk.gray(`(${branch})`)}`,
        value: { type: 'switch', path: wt.path }
      });
    });
  }
  
  // Add create new option
  choices.push(new inquirer.Separator(chalk.gray('── Create New ──')));
  choices.push({
    name: chalk.green('✨ Create new worktree'),
    value: { type: 'create' }
  });
  
  // Add separator and exit
  choices.push(new inquirer.Separator());
  choices.push({
    name: chalk.gray('Exit'),
    value: { type: 'exit' }
  });
  
  // Show current worktree info
  console.log(chalk.gray(`\nCurrently in: ${chalk.white(path.basename(currentPath))} ${chalk.gray(`(${currentBranch || 'no branch'})`)}}`));
  
  // Ask user to select
  const { selection } = await inquirer.prompt([{
    type: 'list',
    name: 'selection',
    message: 'Select a worktree or create a new one:',
    choices: choices,
    pageSize: 15
  }]);
  
  if (selection.type === 'exit') {
    console.log(chalk.gray('Goodbye!'));
    process.exit(0);
  }
  
  if (selection.type === 'switch') {
    await switchToWorktree(selection.path);
    return;
  }
  
  // Create new worktree flow
  const questions = [
    {
      type: 'input',
      name: 'branchName',
      message: 'Enter the branch name for the new worktree:',
      validate: validateBranchName,
      when: () => !options.fromExisting
    },
    {
      type: 'list',
      name: 'branchName',
      message: 'Select an existing branch:',
      choices: existingBranches,
      when: () => options.fromExisting && existingBranches.length > 0
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  await createWorktree(answers.branchName, options);
}

async function listWorktrees() {
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
      const branch = wt.branch || (wt.detached ? chalk.yellow('detached HEAD') : chalk.gray('no branch'));
      const marker = isCurrent ? chalk.green(' ← current') : '';
      
      console.log(chalk.white(`${index + 1}. ${chalk.bold(path.basename(wt.path))}`));
      console.log(chalk.gray(`   Path: ${wt.path}`));
      console.log(chalk.gray(`   Branch: ${branch}${marker}`));
      console.log();
    });
  }
}

// Setup commander
program
  .name('spawn')
  .description('Git worktree management tool - creates timestamped worktrees')
  .version('1.0.0')
  .argument('[branch-name]', 'Name of the branch to create')
  .option('-e, --editor <editor>', 'Editor to launch (default: claude)')
  .option('-n, --no-editor', 'Do not launch any editor')
  .option('-x, --from-existing', 'Choose from existing branches')
  .option('-l, --list', 'List all worktrees')
  .action(async (branchName, options) => {
    if (options.list) {
      await listWorktrees();
      return;
    }
    
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
  });

// Parse command line arguments
program.parse();