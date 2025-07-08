import chalk from 'chalk';

/**
 * Process git diff output to display cleaner file names
 * @param {string} diffOutput - Raw git diff output
 * @param {number} maxLines - Maximum number of lines to display
 * @returns {string} Processed diff output
 */
export default function processDiffOutput(diffOutput, maxLines = 500) {
  if (!diffOutput || !diffOutput.trim()) {
    return chalk.gray('No changes');
  }

  const lines = diffOutput.split('\n');
  const processedLines = [];
  let lineCount = 0;

  for (let i = 0; i < lines.length && lineCount < maxLines; i++) {
    const line = lines[i];

    // Remove ANSI color codes for pattern matching
    // eslint-disable-next-line no-control-regex
    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');

    // Check for diff header
    if (cleanLine.startsWith('diff --git')) {
      // Extract filename from the diff header
      const fileMatch = cleanLine.match(/diff --git a\/(.+) b\/.+/);
      if (fileMatch) {
        const fileName = fileMatch[1];
        processedLines.push(''); // Empty line before file name
        processedLines.push(chalk.yellow(`📄 ${fileName}`));
        lineCount += 2;
      }
      continue;
    }

    // Skip the --- and +++ lines as they're redundant
    if (cleanLine.startsWith('---') || cleanLine.startsWith('+++')) {
      continue;
    }

    // Keep all other lines (@@, +, -, context lines, etc.)
    processedLines.push(line);
    lineCount++;
  }

  let result = processedLines.join('\n');

  if (lines.length > maxLines) {
    result += chalk.yellow(`\n... diff truncated (${lines.length - maxLines} more lines) ...`);
  }

  return result;
}
