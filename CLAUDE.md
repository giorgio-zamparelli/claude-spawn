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

The codebase uses ESM modules and has a simple flat structure:

- `spawn.js` - Main CLI tool built with Commander.js and Inquirer.js that:
  - Validates it's running in a git repository
  - Creates a new git worktree in the parent directory
  - Names the worktree with format: `<repo-name>-<branch-name>`
  - Creates and checks out a new branch with the same name
  - Offers interactive mode for branch selection and editor choice
  - Supports multiple editors (Claude, VS Code)
  - Lists existing worktrees
- `index.js` - Simple entry point (currently just a hello world placeholder)

## Key Implementation Details

The spawner tool workflow (spawn.js:1-244):

1. Checks if current directory is a git repository
2. Gets the parent directory of the current repository
3. Creates directory name with format: repo-name-branch-name
4. Validates branch names and handles existing worktrees
5. Creates a git worktree with a new branch
6. Automatically launches Claude editor (unless --no-editor is used)

The tool uses:

- ESM modules (`type: "module"` in package.json)
- Commander.js for CLI argument parsing
- Inquirer.js for interactive prompts
- Node.js child_process to execute git commands
