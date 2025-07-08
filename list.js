import path from 'path';
import chalk from 'chalk';
import isGitRepository from './utils/isGitRepository.js';
import getGitRootDirectory from './utils/getGitRootDirectory.js';
import getWorktrees from './utils/getWorktrees.js';

export async function listWorktrees() {
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
      const branch =
        wt.branch || (wt.detached ? chalk.yellow('detached HEAD') : chalk.gray('no branch'));
      const marker = isCurrent ? chalk.green(' ← current') : '';

      console.log(chalk.white(`${index + 1}. ${chalk.bold(path.basename(wt.path))}`));
      console.log(chalk.gray(`   Path: ${wt.path}`));
      console.log(chalk.gray(`   Branch: ${branch}${marker}`));
      console.log();
    });
  }
}

export function createListCommand(program) {
  program
    .command('list')
    .description('List all worktrees')
    .action(async () => {
      await listWorktrees();
    });
}
