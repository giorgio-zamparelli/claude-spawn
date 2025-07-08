import executeCommand from './executeCommand.js';

export default function getLocalBranches() {
  const result = executeCommand('git branch');
  if (!result) return [];

  return result
    .split('\n')
    .map((branch) => {
      // Remove the current branch marker (*) and any leading/trailing spaces
      return branch.replace(/^\*?\s+/, '').trim();
    })
    .filter((branch) => branch && branch !== '');
}
