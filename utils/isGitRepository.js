import executeCommand from './executeCommand.js';

export default function isGitRepository() {
  const result = executeCommand('git rev-parse --is-inside-work-tree');
  return result && result.trim() === 'true';
}
