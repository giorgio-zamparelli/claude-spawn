import { execSync } from 'child_process';

export default function executeCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch {
    return null;
  }
}
