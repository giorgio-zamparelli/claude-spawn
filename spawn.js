#!/usr/bin/env node

import { program } from 'commander';
import { createListCommand } from './list.js';
import { createRemoveCommand } from './remove.js';
import { createAddCommand } from './add.js';
import { createDiffCommand } from './diff.js';
import { createMergeCommand } from './merge.js';
import { createApproveCommand } from './approve.js';

// Setup commander
program
  .name('spawn')
  .description(
    'Manage multiple Claude Code instances in parallel using Git worktrees - work on different features simultaneously without conflicts'
  )
  .version('1.0.0');

// Add list subcommand
createListCommand(program);

// Add remove subcommand
createRemoveCommand(program);

// Add diff subcommand
createDiffCommand(program);

// Add merge subcommand
createMergeCommand(program);

// Add approve subcommand
createApproveCommand(program);

// Default command for creating/managing worktrees
createAddCommand(program);

// Parse command line arguments
program.parse();
