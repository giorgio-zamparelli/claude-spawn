import { execSync } from 'child_process';

/**
 * Set the terminal tab name
 * @param {string} name - The name to set for the terminal tab
 */
export default function setTerminalTabName(name) {
  try {
    // Try multiple escape sequences for better compatibility
    // \033]0; sets both window and tab title
    // \033]1; sets tab title
    // \033]2; sets window title
    // Using both to ensure compatibility with different terminals including Warp
    execSync(`printf "\\033]0;${name}\\007"`, { stdio: 'inherit' });
    execSync(`printf "\\033]1;${name}\\007"`, { stdio: 'inherit' });

    // Also try the OSC 7 sequence which some modern terminals prefer
    // This includes the current working directory
    const cwd = process.cwd();
    execSync(`printf "\\033]7;file://${cwd}\\007"`, { stdio: 'inherit' });
  } catch {
    // Silently fail if the terminal doesn't support this
    // Some terminals might not support setting tab names
  }
}
