import executeCommand from './executeCommand.js';

export default function getExistingBranches() {
  const result = executeCommand('git branch -a');
  if (!result) return [];

  return (
    result
      .split('\n')
      .map((branch) => {
        // Remove the current branch marker (*) and any leading/trailing spaces
        let cleanBranch = branch.replace(/^\*?\s+/, '').trim();
        // Remove any leading + or - markers (from git branch -a output)
        cleanBranch = cleanBranch.replace(/^[+-]\s+/, '');
        // Remove remote prefix if present
        cleanBranch = cleanBranch.replace(/^remotes\/origin\//, '');
        return cleanBranch;
      })
      .filter((branch) => branch && branch !== '')
      // Remove duplicates
      .filter((branch, index, self) => self.indexOf(branch) === index)
  );
}
