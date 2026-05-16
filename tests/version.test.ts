// tests/version.test.ts

import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/utils/version.js';

describe('VERSION', () => {
  it('reads a semver-shaped string from package.json', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
