import { describe, it, expect } from 'vitest';

import { ISO8601Duration2sec } from 'utils/timeManipulation';

describe('ISO8601Duration2sec', () => {
  it('should handle only seconds', () => {
    expect(ISO8601Duration2sec('PT5S')).toEqual(5);
  });
  it('should handle only min', () => {
    // 1min = 60s
    expect(ISO8601Duration2sec('PT5M')).toEqual(300);
  });
  it('should handle only hours', () => {
    // 1h = 60min
    expect(ISO8601Duration2sec('PT1H')).toEqual(3600);
  });
  it('should handle hours, mins and seconds', () => {
    expect(ISO8601Duration2sec('PT1H1M1S')).toEqual(3661);
  });
  it('should handle hours and seconds without min', () => {
    expect(ISO8601Duration2sec('PT1H1S')).toEqual(3601);
  });
});
