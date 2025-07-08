import executeCommand from './executeCommand.js';

export default function getLocalBranches() {
  const result = executeCommand('git branch');
  if (!result) return [];

  return result
    .split('\n')
    .map((branch) => {
      // Remove the current branch marker (*) and any leading/trailing spaces
      let cleanBranch = branch.replace(/^\*?\s+/, '').trim();
      // Also remove any leading + or - markers that git might add
      cleanBranch = cleanBranch.replace(/^[+-]\s+/, '');
      return cleanBranch;
    })
    .filter((branch) => branch && branch !== '');
}
