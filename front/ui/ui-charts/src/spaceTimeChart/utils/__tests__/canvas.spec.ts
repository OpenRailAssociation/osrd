import { vi, describe, it, expect, afterEach } from 'vitest';

import { computeVisibleTimeMarkers } from '../canvas';

describe('displayElementsBasedOnZoom', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should give 0h, 12h, 6h 18h in LOCAL timezone, UTC+2', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-120);
    const minT = 1712008800000; // 00:00:00 GMT+0200
    const maxT = 1712025400000; // 04:36:40 GMT+0200
    const timeRanges = [
      10000, 30000, 60000, 300000, 900000, 1800000, 3600000, 10800000, 21600000, 43200000, 86400000,
    ];
    const gridlinesLevels = [0, 0, 0, 0, 6, 5, 4, 3, 3, 2, 1];
    const result = computeVisibleTimeMarkers(minT, maxT, timeRanges, gridlinesLevels);
    expect(result).toEqual([
      { level: 1, time: 1712008800000 },
      { level: 6, time: 1712009700000 },
      { level: 5, time: 1712010600000 },
      { level: 6, time: 1712011500000 },
      { level: 4, time: 1712012400000 },
      { level: 6, time: 1712013300000 },
      { level: 5, time: 1712014200000 },
      { level: 6, time: 1712015100000 },
      { level: 4, time: 1712016000000 },
      { level: 6, time: 1712016900000 },
      { level: 5, time: 1712017800000 },
      { level: 6, time: 1712018700000 },
      { level: 3, time: 1712019600000 },
      { level: 6, time: 1712020500000 },
      { level: 5, time: 1712021400000 },
      { level: 6, time: 1712022300000 },
      { level: 4, time: 1712023200000 },
      { level: 6, time: 1712024100000 },
      { level: 5, time: 1712025000000 },
    ]);
    const times = result.map(({ time }) =>
      new Date(time).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' })
    );

    expect(times).toEqual([
      '00:00:00',
      '00:15:00',
      '00:30:00',
      '00:45:00',
      '01:00:00',
      '01:15:00',
      '01:30:00',
      '01:45:00',
      '02:00:00',
      '02:15:00',
      '02:30:00',
      '02:45:00',
      '03:00:00',
      '03:15:00',
      '03:30:00',
      '03:45:00',
      '04:00:00',
      '04:15:00',
      '04:30:00',
    ]);
  });
  it('should give 0h, 12h, 6h 18h in LOCAL timezone, UTC-2', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(120);
    const minT = 1712023200000; // 00:00:00 GMT-0200
    const maxT = 1712066400000; // 12:00:00 GMT-0200
    const timeRanges = [
      10000, 30000, 60000, 300000, 900000, 1800000, 3600000, 10800000, 21600000, 43200000, 86400000,
    ];
    const gridlinesLevels = [0, 0, 0, 0, 0, 0, 4, 3, 3, 2, 1];
    const result = computeVisibleTimeMarkers(minT, maxT, timeRanges, gridlinesLevels);
    expect(result).toEqual([
      { level: 1, time: 1712023200000 },
      { level: 4, time: 1712026800000 },
      { level: 4, time: 1712030400000 },
      { level: 3, time: 1712034000000 },
      { level: 4, time: 1712037600000 },
      { level: 4, time: 1712041200000 },
      { level: 3, time: 1712044800000 },
      { level: 4, time: 1712048400000 },
      { level: 4, time: 1712052000000 },
      { level: 3, time: 1712055600000 },
      { level: 4, time: 1712059200000 },
      { level: 4, time: 1712062800000 },
      { level: 2, time: 1712066400000 },
    ]);
    const times = result.map(({ time }) =>
      new Date(time).toLocaleTimeString('fr-FR', { timeZone: 'America/Noronha' })
    );
    expect(times).toEqual([
      '00:00:00',
      '01:00:00',
      '02:00:00',
      '03:00:00',
      '04:00:00',
      '05:00:00',
      '06:00:00',
      '07:00:00',
      '08:00:00',
      '09:00:00',
      '10:00:00',
      '11:00:00',
      '12:00:00',
    ]);
  });
});
