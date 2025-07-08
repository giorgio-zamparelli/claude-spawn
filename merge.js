import { execSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import isGitRepository from './utils/isGitRepository.js';
import getGitRootDirectory from './utils/getGitRootDirectory.js';
import getCurrentBranch from './utils/getCurrentBranch.js';
import getLocalBranches from './utils/getLocalBranches.js';
import getWorktrees from './utils/getWorktrees.js';
import { removeWorktree } from './utils/removeWorktree.js';
import processDiffOutput from './utils/processDiffOutput.js';
import setTerminalTabName from './utils/setTerminalTabName.js';

function hasUncommittedChanges() {
  try {
    const result = execSync('git status --porcelain', { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function getBranchAheadBehind(branch, baseBranch) {
  try {
    const result = execSync(`git rev-list --left-right --count ${baseBranch}...${branch}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
    });
    const [behind, ahead] = result.trim().split('\t').map(Number);
    return { ahead, behind };
  } catch {
    // Return null to indicate the branch comparison failed
    return null;
  }
}

async function performMerge(branchName, currentBranch) {
  // Set terminal tab name to show merge operation
  setTerminalTabName(`merge ${branchName}`);

  console.log(
    chalk.blue(`\nMerging ${chalk.white(branchName)} into ${chalk.white(currentBranch)}...\n`)
  );

  try {
    // Check if the branch exists locally
    const branches = getLocalBranches();
    if (!branches.includes(branchName)) {
      console.error(chalk.red(`Error: Branch '${branchName}' does not exist locally`));
      console.log(chalk.yellow('Tip: Use git fetch to update remote branches'));
      // Restore terminal tab name
      setTerminalTabName(currentBranch);
      return false;
    }

    // Check for uncommitted changes
    if (hasUncommittedChanges()) {
      // Check if we're in the middle of a merge
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      const hasConflicts =
        status.includes('UU ') || status.includes('AA ') || status.includes('DD ');

      // Also check if MERGE_HEAD exists (indicates an ongoing merge)
      let inMergeState = false;
      try {
        execSync('git rev-parse --verify MERGE_HEAD', { stdio: 'pipe' });
        inMergeState = true;
      } catch {
        // MERGE_HEAD doesn't exist, not in merge state
      }

      if (hasConflicts || inMergeState) {
        console.error(chalk.red('Error: You have an unresolved merge from a previous operation.'));
        console.log(
          chalk.yellow('\nYou must complete or abort the existing merge before starting a new one.')
        );

        // Show conflicted files
        console.log(chalk.blue('\nStatus:'));
        const files = status
          .trim()
          .split('\n')
          .filter((line) => line.trim());

        files.forEach((file) => {
          const [statusCode, ...fileParts] = file.split(' ');
          const fileName = fileParts.join(' ');
          let statusText = '';

          if (statusCode.includes('U')) statusText = chalk.red('conflict');
          else if (statusCode.includes('M')) statusText = chalk.yellow('modified');
          else if (statusCode.includes('A')) statusText = chalk.green('added');
          else if (statusCode.includes('D')) statusText = chalk.red('deleted');
          else if (statusCode === '??') statusText = chalk.gray('untracked');

          console.log(`  ${statusText}: ${fileName}`);
        });

        console.log(chalk.yellow('\n📝 Options:'));
        console.log(chalk.gray('• To abort the current merge: git merge --abort'));
        console.log(chalk.gray('• To resolve conflicts:'));
        console.log(chalk.gray('  1. Fix conflicts in the files listed above'));
        console.log(chalk.gray('  2. Stage resolved files: git add <file>'));
        console.log(chalk.gray('  3. Complete the merge: git commit'));

        // Restore terminal tab name
        setTerminalTabName(currentBranch);
        return false;
      }

      console.error(chalk.red('Error: You have uncommitted changes.'));

      // Show status
      console.log(chalk.blue('\nUncommitted files:'));
      const files = status
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      files.forEach((file) => {
        const [statusCode, ...fileParts] = file.split(' ');
        const fileName = fileParts.join(' ');
        let statusText = '';

        if (statusCode.includes('M')) statusText = chalk.yellow('modified');
        else if (statusCode.includes('A')) statusText = chalk.green('added');
        else if (statusCode.includes('D')) statusText = chalk.red('deleted');
        else if (statusCode.includes('U')) statusText = chalk.red('conflict');
        else if (statusCode === '??') statusText = chalk.gray('untracked');

        console.log(`  ${statusText}: ${fileName}`);
      });

      // Show diff for tracked files
      console.log(chalk.blue('\nChanges:'));
      try {
        // Show staged changes
        const stagedDiff = execSync('git --no-pager diff --cached --color=always', {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10,
        });
        if (stagedDiff.trim()) {
          console.log(chalk.gray('\nStaged changes:'));
          console.log(processDiffOutput(stagedDiff, 300));
        }

        // Show unstaged changes
        const unstagedDiff = execSync('git --no-pager diff --color=always', {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10,
        });
        if (unstagedDiff.trim()) {
          console.log(chalk.gray('\nUnstaged changes:'));
          console.log(processDiffOutput(unstagedDiff, 300));
        }
      } catch {
        console.log(chalk.yellow('Could not generate diff preview'));
      }

      // Ask user what to do
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Commit changes', value: 'commit' },
            { name: 'Stash changes', value: 'stash' },
            { name: 'Discard changes (reset --hard)', value: 'discard' },
            { name: 'Cancel merge', value: 'cancel' },
          ],
        },
      ]);

      switch (action) {
        case 'commit': {
          const { commitMessage } = await inquirer.prompt([
            {
              type: 'input',
              name: 'commitMessage',
              message: 'Enter commit message:',
              validate: (input) => input.trim().length > 0 || 'Commit message cannot be empty',
            },
          ]);
          try {
            execSync('git add -A', { stdio: 'inherit' });
            execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
            console.log(chalk.green('✅ Changes committed successfully'));
          } catch {
            console.error(chalk.red('Failed to commit changes'));
            // Restore terminal tab name
            setTerminalTabName(currentBranch);
            return false;
          }
          break;
        }

        case 'stash':
          try {
            execSync('git stash push -m "Pre-merge stash"', { stdio: 'inherit' });
            console.log(chalk.green('✅ Changes stashed successfully'));
          } catch {
            console.error(chalk.red('Failed to stash changes'));
            // Restore terminal tab name
            setTerminalTabName(currentBranch);
            return false;
          }
          break;

        case 'discard': {
          const { confirmDiscard } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmDiscard',
              message: chalk.red(
                'Are you sure you want to discard all changes? This cannot be undone!'
              ),
              default: false,
            },
          ]);
          if (confirmDiscard) {
            try {
              execSync('git reset --hard', { stdio: 'inherit' });
              console.log(chalk.yellow('⚠️  All changes discarded'));
            } catch {
              console.error(chalk.red('Failed to discard changes'));
              // Restore terminal tab name
              setTerminalTabName(currentBranch);
              return false;
            }
          } else {
            // Restore terminal tab name
            setTerminalTabName(currentBranch);
            return false;
          }
          break;
        }

        case 'cancel':
        default:
          console.log(chalk.gray('Merge cancelled.'));
          // Restore terminal tab name
          setTerminalTabName(currentBranch);
          return false;
      }
    }

    // Show what will be merged
    const branchInfo = getBranchAheadBehind(branchName, currentBranch);
    if (!branchInfo) {
      console.log(
        chalk.yellow(`Could not determine branch relationship. Proceeding with merge...`)
      );
    } else {
      const { ahead } = branchInfo;
      if (ahead === 0) {
        console.log(chalk.yellow(`\nBranch '${branchName}' has no new commits to merge.`));

        // Ask if user wants to remove the branch/worktree
        const { removeBranch } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'removeBranch',
            message: `Do you want to remove the branch '${branchName}' and its worktree?`,
            default: false,
          },
        ]);

        if (removeBranch) {
          console.log(chalk.yellow(`\nRemoving branch '${branchName}' and its worktree...`));
          await removeWorktree(branchName, { forceDeleteBranch: true });
        }

        // Restore terminal tab name
        setTerminalTabName(currentBranch);
        return true;
      }
      console.log(
        chalk.gray(`Branch '${branchName}' is ${ahead} commit(s) ahead of '${currentBranch}'.`)
      );
    }

    // Show preview of commits to be merged
    console.log(chalk.blue('\nCommits to be merged:'));
    execSync(`git --no-pager log --oneline --color=always ${currentBranch}..${branchName}`, {
      stdio: 'inherit',
    });

    // Show file changes summary
    console.log(chalk.blue('\nFiles to be changed:'));
    execSync(`git --no-pager diff --stat --color=always ${currentBranch}...${branchName}`, {
      stdio: 'inherit',
    });

    // Show actual diff (limited to prevent overwhelming output)
    console.log(chalk.blue('\nChanges preview:'));
    try {
      // Get diff with context limited to 3 lines and no more than 500 lines total
      const diffOutput = execSync(
        `git --no-pager diff --color=always --unified=3 ${currentBranch}...${branchName}`,
        { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
      );

      console.log(processDiffOutput(diffOutput, 500));
    } catch {
      console.log(chalk.yellow('Could not generate diff preview'));
    }

    // Confirm merge
    const { confirmMerge } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmMerge',
        message: `Do you want to merge '${branchName}' into '${currentBranch}'?`,
        default: true,
      },
    ]);

    if (!confirmMerge) {
      console.log(chalk.gray('Merge cancelled.'));
      // Restore terminal tab name
      setTerminalTabName(currentBranch);
      return false;
    }

    // Perform the merge with automatic commit message
    console.log(chalk.yellow('\nPerforming merge...'));
    const mergeMessage = `Merge branch '${branchName}' into ${currentBranch}`;

    try {
      execSync(`git merge ${branchName} -m "${mergeMessage}"`, { stdio: 'inherit' });

      console.log(chalk.green(`\n✅ Successfully merged '${branchName}' into '${currentBranch}'`));

      // Show merge summary
      console.log(chalk.blue('\nMerge summary:'));
      execSync('git --no-pager log --oneline --color=always -1', { stdio: 'inherit' });

      // Ask if user wants to remove the merged branch/worktree
      const { removeBranch } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'removeBranch',
          message: `Do you want to remove the branch '${branchName}' and its worktree?`,
          default: true,
        },
      ]);

      if (removeBranch) {
        console.log(chalk.yellow(`\nRemoving branch '${branchName}' and its worktree...`));
        await removeWorktree(branchName, { forceDeleteBranch: true });
      }

      // Restore terminal tab name to current branch
      setTerminalTabName(currentBranch);
    } catch (mergeError) {
      // Check if this is a merge conflict
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.includes('UU ') || status.includes('AA ') || status.includes('DD ')) {
        // Merge conflict detected
        console.log(chalk.yellow('\n⚠️  Merge conflict detected!'));
        console.log(chalk.blue('\nConflicted files:'));

        // Show conflicted files
        const conflictedFiles = status
          .split('\n')
          .filter(
            (line) => line.startsWith('UU ') || line.startsWith('AA ') || line.startsWith('DD ')
          )
          .map((line) => line.substring(3));

        conflictedFiles.forEach((file) => {
          console.log(chalk.red(`  • ${file}`));
        });

        console.log(chalk.yellow('\n📝 To resolve:'));
        console.log(chalk.gray('1. Fix the conflicts in the listed files'));
        console.log(chalk.gray('2. Stage the resolved files: git add <file>'));
        console.log(chalk.gray('3. Complete the merge: git commit'));
        console.log(chalk.gray('4. Or abort the merge: git merge --abort'));

        // Restore terminal tab name
        setTerminalTabName(currentBranch);
        return false;
      }

      // Other merge error
      throw mergeError;
    }

    return true;
  } catch (error) {
    console.error(chalk.red(`\nError during merge: ${error.message}`));
    // Restore terminal tab name
    setTerminalTabName(currentBranch);
    return false;
  }
}

async function interactiveMerge() {
  console.log(chalk.cyan.bold('\n🔀 Git Merge Tool\n'));

  const currentBranch = getCurrentBranch();
  if (!currentBranch) {
    console.error(chalk.red('Error: Could not determine current branch'));
    return;
  }

  console.log(chalk.gray(`Current branch: ${chalk.white(currentBranch)}`));

  // Get local branches only (not remote branches)
  const branches = getLocalBranches().filter((branch) => branch !== currentBranch);

  if (branches.length === 0) {
    console.log(chalk.yellow('No other branches available to merge.'));
    return;
  }

  // Get worktrees for additional context
  const worktrees = getWorktrees();
  const gitRoot = getGitRootDirectory();

  // Build choices with branch info
  const choices = branches.map((branch) => {
    const worktree = worktrees.find(
      (wt) => wt.branch && wt.branch.replace('refs/heads/', '') === branch
    );

    const branchInfo = getBranchAheadBehind(branch, currentBranch);

    let name = chalk.yellow(branch);

    // Add ahead/behind info if available
    if (branchInfo) {
      const { ahead, behind } = branchInfo;
      if (ahead > 0 || behind > 0) {
        const status = [];
        if (ahead > 0) status.push(chalk.green(`↑${ahead}`));
        if (behind > 0) status.push(chalk.red(`↓${behind}`));
        name += chalk.gray(` (${status.join(' ')})`);
      }
    }

    // Add worktree info
    if (worktree && worktree.path !== gitRoot) {
      name += chalk.gray(` [${path.basename(worktree.path)}]`);
    }

    return {
      name,
      value: branch,
    };
  });

  // Sort by branches with commits to merge first
  choices.sort((a, b) => {
    const aMatch = a.name.match(/↑(\d+)/);
    const bMatch = b.name.match(/↑(\d+)/);
    const aAhead = aMatch ? parseInt(aMatch[1]) : 0;
    const bAhead = bMatch ? parseInt(bMatch[1]) : 0;
    return bAhead - aAhead;
  });

  // Add separator and cancel option
  choices.push(new inquirer.Separator());
  choices.push({
    name: chalk.gray('Cancel'),
    value: null,
  });

  const { selectedBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBranch',
      message: 'Select a branch to merge into current branch:',
      choices: choices,
      pageSize: 15,
    },
  ]);

  if (!selectedBranch) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  // Clean the branch name in case it has any unwanted prefixes
  const cleanBranchName = selectedBranch.replace(/^[+-]\s*/, '').trim();

  await performMerge(cleanBranchName, currentBranch);
}

export async function mergeCommand(branchName) {
  if (!isGitRepository()) {
    console.error(chalk.red('Error: Not in a git repository'));
    process.exit(1);
  }

  const currentBranch = getCurrentBranch();
  if (!currentBranch) {
    console.error(chalk.red('Error: Could not determine current branch'));
    process.exit(1);
  }

  if (branchName) {
    // Direct merge mode
    await performMerge(branchName, currentBranch);
  } else {
    // Interactive mode
    await interactiveMerge();
  }
}

export function createMergeCommand(program) {
  program
    .command('merge [branch-name]')
    .description('Merge another branch into the current branch')
    .action(async (branchName) => {
      await mergeCommand(branchName);
    });
}
