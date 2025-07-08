export default function validateBranchName(name) {
  // Basic validation for git branch names
  const invalidChars = /[\s~^:?*[\\]/;
  if (invalidChars.test(name)) {
    return 'Branch name contains invalid characters';
  }
  if (
    name.startsWith('-') ||
    name.startsWith('+') ||
    name.endsWith('.') ||
    name.endsWith('.lock')
  ) {
    return 'Invalid branch name format';
  }
  if (name.includes('..') || name.includes('@{') || name.includes('\\')) {
    return 'Branch name contains invalid sequences';
  }
  return true;
}
