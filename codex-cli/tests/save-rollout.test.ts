import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Import the helper for determining sessions directory
import { getSessionsRoot } from '../src/utils/storage/save-rollout';

describe('getSessionsRoot', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear environment variable before each test
    delete process.env.CODEX_SESSIONS_ROOT;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  it('returns project sessions directory by default', () => {
    const expected = path.resolve(process.cwd(), '_sessions');
    expect(getSessionsRoot()).toBe(expected);
  });

  it('returns CODEX_SESSIONS_ROOT when set', () => {
    process.env.CODEX_SESSIONS_ROOT = './custom-dir';
    const expected = path.resolve('./custom-dir');
    expect(getSessionsRoot()).toBe(expected);
  });

  it('ignores empty or whitespace-only env var', () => {
    process.env.CODEX_SESSIONS_ROOT = '   ';
    const expected = path.resolve(process.cwd(), '_sessions');
    expect(getSessionsRoot()).toBe(expected);
  });
});