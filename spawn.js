#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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

function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 1) {
    console.error('Usage: spawn BRANCH_NAME');
    console.error('Example: spawn fix-vitest');
    process.exit(1);
  }

  const branchName = args[0];

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
  const worktreeName = `${repoName}-${branchName}`;
  const worktreePath = path.join(parentDir, worktreeName);

  console.log(`Creating worktree for branch '${branchName}'...`);
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
    
    console.log(`\nLaunching Claude...`);
    execSync('claude', { stdio: 'inherit' });
    
  } catch (error) {
    console.error(`\nError creating worktree: ${error.message}`);
    process.exit(1);
  }
}

main();