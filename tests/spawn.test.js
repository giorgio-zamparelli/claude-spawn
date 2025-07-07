import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';

// Mock the modules
vi.mock('child_process');
vi.mock('fs');
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
    Separator: vi.fn().mockImplementation(() => ({})),
  },
}));
vi.mock('chalk', () => ({
  default: {
    red: (str) => str,
    blue: (str) => str,
    green: (str) => str,
    yellow: (str) => str,
    gray: (str) => str,
    cyan: { bold: (str) => str },
    white: (str) => str,
    bold: (str) => str,
  },
}));

// Import functions after mocking
const spawn = await import('../spawn.js');

describe('Spawn Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isGitRepository', () => {
    it('should return true when in a git repository', () => {
      execSync.mockReturnValue('true\n');
      const result = spawn.isGitRepository();
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('git rev-parse --is-inside-work-tree', {
        encoding: 'utf8',
      });
    });

    it('should return false when not in a git repository', () => {
      execSync.mockReturnValue('false\n');
      const result = spawn.isGitRepository();
      expect(result).toBe(false);
    });
  });

  describe('getGitRootDirectory', () => {
    it('should return the git root directory', () => {
      const mockPath = '/Users/test/project';
      execSync.mockReturnValue(mockPath + '\n');
      const result = spawn.getGitRootDirectory();
      expect(result).toBe(mockPath);
      expect(execSync).toHaveBeenCalledWith('git rev-parse --show-toplevel', {
        encoding: 'utf8',
      });
    });

    it('should return null when command fails', () => {
      execSync.mockImplementation(() => {
        throw new Error('Command failed');
      });
      const result = spawn.getGitRootDirectory();
      expect(result).toBeNull();
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', () => {
      execSync.mockReturnValue('main\n');
      const result = spawn.getCurrentBranch();
      expect(result).toBe('main');
      expect(execSync).toHaveBeenCalledWith('git branch --show-current', {
        encoding: 'utf8',
      });
    });

    it('should return null when on detached HEAD', () => {
      execSync.mockImplementation(() => {
        throw new Error('HEAD detached');
      });
      const result = spawn.getCurrentBranch();
      expect(result).toBeNull();
    });
  });

  describe('validateBranchName', () => {
    it('should return true for valid branch names', () => {
      expect(spawn.validateBranchName('feature-branch')).toBe(true);
      expect(spawn.validateBranchName('fix-123')).toBe(true);
      expect(spawn.validateBranchName('test_branch')).toBe(true);
    });

    it('should return error message for invalid branch names', () => {
      expect(spawn.validateBranchName('branch name')).toBe(
        'Branch name contains invalid characters'
      );
      expect(spawn.validateBranchName('branch~name')).toBe(
        'Branch name contains invalid characters'
      );
      expect(spawn.validateBranchName('-branch')).toBe('Invalid branch name format');
      expect(spawn.validateBranchName('branch.')).toBe('Invalid branch name format');
      expect(spawn.validateBranchName('branch.lock')).toBe('Invalid branch name format');
    });
  });

  describe('worktreeExists', () => {
    it('should return true when worktree exists', () => {
      fs.existsSync.mockReturnValue(true);
      const result = spawn.worktreeExists('/path/to/worktree');
      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/worktree');
    });

    it('should return false when worktree does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const result = spawn.worktreeExists('/path/to/worktree');
      expect(result).toBe(false);
    });
  });

  describe('getExistingBranches', () => {
    it('should return list of branches', () => {
      const mockOutput = `  main
  * develop
  feature-1
  remotes/origin/feature-2
  remotes/origin/HEAD -> origin/main`;
      execSync.mockReturnValue(mockOutput);
      const result = spawn.getExistingBranches();
      expect(result).toEqual(['main', 'develop', 'feature-1', 'feature-2', 'HEAD -> origin/main']);
    });

    it('should return empty array when no branches', () => {
      execSync.mockImplementation(() => {
        throw new Error('No branches');
      });
      const result = spawn.getExistingBranches();
      expect(result).toEqual([]);
    });
  });

  describe('getWorktrees', () => {
    it('should parse worktree list correctly', () => {
      const mockOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature`;
      execSync.mockReturnValue(mockOutput);
      const result = spawn.getWorktrees();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: '/path/to/main',
        head: 'abc123',
        branch: 'refs/heads/main',
      });
      expect(result[1]).toEqual({
        path: '/path/to/feature',
        head: 'def456',
        branch: 'refs/heads/feature',
      });
    });

    it('should handle detached worktrees', () => {
      const mockOutput = `worktree /path/to/detached
HEAD abc123
detached`;
      execSync.mockReturnValue(mockOutput);
      const result = spawn.getWorktrees();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: '/path/to/detached',
        head: 'abc123',
        detached: true,
      });
    });

    it('should return empty array when command fails', () => {
      execSync.mockImplementation(() => {
        throw new Error('Command failed');
      });
      const result = spawn.getWorktrees();
      expect(result).toEqual([]);
    });
  });
});
