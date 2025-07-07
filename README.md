# Spawner

A Git worktree management CLI tool that creates organized worktrees with REPO-BRANCH naming convention.

## Features

- Create git worktrees with REPO-BRANCH naming (e.g., waiterio-three)
- Interactive mode with colorful prompts using Inquirer.js and Chalk
- Single menu to select existing worktrees or create new ones
- Switch between worktrees with automatic editor launch
- Choose from existing branches or create new ones
- Automatic editor launch (Claude, VS Code, or none)
- Branch name validation
- List all existing worktrees with colored output
- Handle existing worktree conflicts

## Installation

```bash
npm install
```

To make the `spawn` command available globally:

```bash
npm link
```

## Usage

### Basic Usage

Create a new worktree with a branch name:

```bash
spawn fix-bug
# Creates worktree at ../myrepo-fix-bug
```

### Interactive Mode

Run without arguments for interactive prompts:

```bash
spawn
# Prompts for branch name, editor choice, etc.
```

### Command Options

```bash
# List all worktrees
spawn --list
spawn -l

# Choose editor to launch
spawn fix-bug --editor code    # Launch VS Code
spawn fix-bug --editor claude   # Launch Claude (default)
spawn fix-bug --no-editor       # Don't launch any editor

# Select from existing branches
spawn --from-existing
spawn -x

# Help
spawn --help
spawn -h
```

## How It Works

1. Validates that you're in a git repository
2. Creates a worktree in the parent directory with format: `<repo-name>-<branch-name>`
3. Creates and checks out a new branch
4. Automatically launches Claude editor (or specified editor)

## Examples

```bash
# Create a feature branch
spawn add-login-feature

# Create a bugfix without launching editor
spawn fix-memory-leak --no-editor

# Use VS Code instead of Claude
spawn implement-api --editor code

# Interactive mode with existing branches
spawn -x
```

## Requirements

- Node.js
- Git
- Claude CLI (optional, for default editor)
- VS Code CLI (optional, if using --editor code)

## Development

This project uses npm for package management and includes:
- Commander.js for CLI argument parsing
- Inquirer.js for interactive prompts