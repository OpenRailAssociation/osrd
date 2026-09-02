import { describe, expect, it } from 'vitest';

import { indexToColor, colorToIndex } from '../colors';

describe('indexToColor', () => {
  it('should roundtrip', () => {
    const testCases = [0, 1, 0xff, 0x100, 0xff00, 0x420000, 0xffffff];
    for (const index of testCases) {
      expect(colorToIndex(indexToColor(index))).toBe(index);
    }
  });
});
