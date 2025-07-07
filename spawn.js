#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { program } from 'commander';
import inquirer from 'inquirer';

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
    console.error('Error: Not in a git repository');
    process.exit(1);
  }

  const gitRoot = getGitRootDirectory();
  if (!gitRoot) {
    console.error('Error: Could not determine git root directory');
    process.exit(1);
  }

  const repoName = path.basename(gitRoot);
  const parentDir = path.dirname(gitRoot);
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const worktreeName = `${timestamp}-${branchName}`;
  const worktreePath = path.join(parentDir, worktreeName);

  // Check if worktree already exists
  if (worktreeExists(worktreePath)) {
    console.error(`Error: Worktree already exists at ${worktreePath}`);
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: 'Do you want to remove the existing worktree and create a new one?',
      default: false
    }]);
    
    if (!overwrite) {
      process.exit(1);
    }
    
    console.log('Removing existing worktree...');
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to remove existing worktree');
      process.exit(1);
    }
  }

  console.log(`\nCreating worktree for branch '${branchName}'...`);
  console.log(`Repository: ${gitRoot}`);
  console.log(`Worktree path: ${worktreePath}`);

  try {
    process.chdir(parentDir);
    
    const gitWorktreeCommand = `git -C "${gitRoot}" worktree add "${worktreePath}" -b "${branchName}"`;
    console.log(`Running: ${gitWorktreeCommand}`);
    
    execSync(gitWorktreeCommand, { stdio: 'inherit' });
    
    console.log(`\nWorktree created successfully!`);
    console.log(`Changing to worktree directory: ${worktreePath}`);
    
    process.chdir(worktreePath);
    
    // Launch editor if not disabled
    if (!options.noEditor) {
      const editor = options.editor || 'claude';
      console.log(`\nLaunching ${editor}...`);
      try {
        execSync(editor, { stdio: 'inherit' });
      } catch (error) {
        console.error(`Warning: Could not launch ${editor}. Make sure it's installed and in your PATH.`);
      }
    }
    
  } catch (error) {
    console.error(`\nError creating worktree: ${error.message}`);
    process.exit(1);
  }
}

async function interactiveMode(options) {
  console.log('Welcome to Git Worktree Spawner!');
  
  const currentBranch = getCurrentBranch();
  if (currentBranch) {
    console.log(`Current branch: ${currentBranch}`);
  }
  
  // Show existing worktrees
  const worktreeList = executeCommand('git worktree list');
  if (worktreeList) {
    const worktreeLines = worktreeList.trim().split('\n');
    if (worktreeLines.length === 1) {
      console.log('\nNo additional worktrees found for this repository.');
    } else {
      console.log('\nExisting worktrees:');
      console.log(worktreeList);
    }
  }
  
  const existingBranches = getExistingBranches();
  
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
    },
    {
      type: 'confirm',
      name: 'confirmCreate',
      message: (answers) => `Create worktree for branch '${answers.branchName}'?`,
      default: true
    },
    {
      type: 'list',
      name: 'editor',
      message: 'Which editor would you like to launch?',
      choices: [
        { name: 'Claude', value: 'claude' },
        { name: 'VS Code', value: 'code' },
        { name: 'None', value: null }
      ],
      default: 'claude',
      when: () => !options.noEditor && !options.editor
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  if (!answers.confirmCreate) {
    console.log('Operation cancelled');
    process.exit(0);
  }
  
  // Override options with interactive choices
  if (answers.editor !== undefined) {
    options.editor = answers.editor;
    if (answers.editor === null) {
      options.noEditor = true;
    }
  }
  
  await createWorktree(answers.branchName, options);
}

async function listWorktrees() {
  if (!isGitRepository()) {
    console.error('Error: Not in a git repository');
    process.exit(1);
  }
  
  const result = executeCommand('git worktree list');
  if (result) {
    console.log('Current worktrees:');
    console.log(result);
  } else {
    console.error('Error: Could not list worktrees');
    process.exit(1);
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
        console.error(`Error: ${validation}`);
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