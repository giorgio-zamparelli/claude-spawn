#!/usr/bin/env node

import { program } from 'commander';
import { createListCommand } from './list.js';
import { createRemoveCommand } from './remove.js';
import { createAddCommand } from './add.js';
import { createDiffCommand } from './diff.js';

// Setup commander
program
  .name('spawn')
  .description('Git worktree management tool - creates timestamped worktrees')
  .version('1.0.0');

// Add list subcommand
createListCommand(program);

// Add remove subcommand
createRemoveCommand(program);

// Add diff subcommand
createDiffCommand(program);

// Default command for creating/managing worktrees
createAddCommand(program);

// Parse command line arguments
program.parse();
