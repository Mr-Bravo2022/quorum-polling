import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// Adds the `toHaveNoViolations()` matcher used by the accessibility tests.
expect.extend(toHaveNoViolations);

// Unmount React trees between tests so the jsdom document stays clean.
afterEach(cleanup);
