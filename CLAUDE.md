# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Git worktree management CLI tool written in Node.js. The main functionality is in `spawn.js`, which creates new git worktrees with a specific naming convention and launches Claude editor.

## Commands

### Running the Tool
```bash
# Execute the spawner CLI
./spawn.js <feature-name>
# or if installed globally
spawn <feature-name>

# Run the main entry point
node index.js
```

### Development Commands
```bash
# Install dependencies (currently none)
npm install

# Run tests (not implemented yet)
npm test
```

## Architecture

The codebase has a simple flat structure:
- `spawn.js` - Main CLI tool that:
  - Validates it's running in a git repository
  - Creates a new git worktree in the parent directory
  - Names the worktree with format: `YYYY-MM-DD-<feature-name>`
  - Creates and checks out a new branch with the same name
  - Launches Claude editor in the new worktree
- `index.js` - Simple entry point (currently just a hello world placeholder)

## Key Implementation Details

The spawner tool workflow (spawn.js:1-43):
1. Checks if current directory is a git repository
2. Gets the parent directory of the current repository
3. Creates a timestamped directory name (YYYY-MM-DD-feature-name)
4. Creates a git worktree with a new branch
5. Launches Claude editor in the new worktree directory

The tool uses Node.js child_process to execute git commands and assumes the `claude` command is available in the system PATH.