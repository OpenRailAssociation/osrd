import { describe, it, expect } from 'vitest';

import { getTrackLine } from 'utils/trackSection';

const line = (line_code: number) => ({
  line_code,
  line_name: `line ${line_code}`,
  track_number: 1,
  track_name: '1',
});

describe('getTrackLine', () => {
  it('should prefer sncf, then any other infrastructure manager by name', () => {
    expect(getTrackLine({ sncf: line(1), oebb: line(2) })?.line_code).toBe(1);
    expect(getTrackLine({ sncf: null, source: null, sbb: line(3), db: line(2) })?.line_code).toBe(
      2
    );
    expect(getTrackLine({ sncf: null, source: null })).toBeUndefined();
  });
});
