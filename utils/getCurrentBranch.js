import executeCommand from './executeCommand.js';

export default function getCurrentBranch() {
  const result = executeCommand('git branch --show-current');
  return result ? result.trim() : null;
}
