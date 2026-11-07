import { describe, it, expect } from 'vitest';
import packageJson from '../package.json';

describe('Project configuration', () => {
  it('has required scripts and dependencies', () => {
    expect(packageJson.scripts.dev).toBeDefined();
    expect(packageJson.scripts.test).toBeDefined();
    expect(packageJson.dependencies.webtorrent).toBeDefined();
  });
});
