import { describe, expect, it } from 'vitest';

import { indexToColor, colorToIndex } from '../colors';

describe('indexToColor', () => {
  it('should roundtrip', () => {
    const testCases = [0, 1, 0xFF, 0x100, 0xFF00, 0x420000, 0xFFFFFF];
    for (const index of testCases) {
      expect(colorToIndex(indexToColor(index))).toBe(index);
    }
  });
});
