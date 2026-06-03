import { it, expect } from 'vitest';

import { formatPropagationDeltaLabelByMode } from '../timePropagation';

// HH:mm:ss diff = 29s, but raw ms diff = 29 700ms → would round up to 30s without the fix
it('formatPropagationDeltaLabelByMode: ignores sub-second precision', () => {
  const oldValue = new Date('2024-01-01T10:00:00.200Z');
  const newValue = new Date('2024-01-01T10:00:29.900Z');
  expect(formatPropagationDeltaLabelByMode(oldValue, newValue, 'atThisWaypoint')).toBe('+00:00:29');
});
