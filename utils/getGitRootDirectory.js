import executeCommand from './executeCommand.js';

export default function getGitRootDirectory() {
  const result = executeCommand('git rev-parse --show-toplevel');
  return result ? result.trim() : null;
}
