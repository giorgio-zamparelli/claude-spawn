import { execSync } from 'child_process';

/**
 * Set the terminal tab name
 * @param {string} name - The name to set for the terminal tab
 */
export default function setTerminalTabName(name) {
  try {
    // Use printf for better compatibility across different shells
    // \033]1; sets the tab title (as opposed to \033]0; which sets window title)
    execSync(`printf "\\033]1;${name}\\007"`, { stdio: 'inherit' });
  } catch {
    // Silently fail if the terminal doesn't support this
    // Some terminals might not support setting tab names
  }
}
