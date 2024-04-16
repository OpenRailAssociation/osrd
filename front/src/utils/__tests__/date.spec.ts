import { dateTimeToIso, isoDateToMs, msToIsoDate } from 'utils/date';

describe('dateTimeToIso', () => {
  it('should return an iso date by passing a date without milliseconds', () => {
    const inputDate = '2024-04-25T08:20';
    const isoDate = dateTimeToIso(inputDate);
    expect(isoDate).toEqual('2024-04-25T08:20:00Z'); // Ends by Z because CI seems to be in UTC timezone
  });

  it('should return an iso date by passing a date with milliseconds', () => {
    const inputDate = '2024-04-25T08:20:10';
    const isoDate = dateTimeToIso(inputDate);
    expect(isoDate).toEqual('2024-04-25T08:20:10Z'); // Ends by Z because CI seems to be in UTC timezone
  });

  it('should return an iso date by passing a date with a space between date and time instead of a T', () => {
    const inputDate = '2024-04-25 08:20:10';
    const isoDate = dateTimeToIso(inputDate);
    expect(isoDate).toEqual('2024-04-25T08:20:10Z'); // Ends by Z because CI seems to be in UTC timezone
  });

  it('should return null by passing a date with the wrong format', () => {
    const inputDate = '04-25 08:20:10';
    const isoDate = dateTimeToIso(inputDate);
    expect(isoDate).toBeNull();
  });
});

describe('isoDateToMs', () => {
  it('should return the date in milliseconds', () => {
    const isoDate = '2024-04-26T20:30:15+02:00';
    const msDate = isoDateToMs(isoDate);
    expect(msDate).toEqual(1714156215000);
  });
});

describe('msToIsoDate', () => {
  it('should return the date in ISO 8601', () => {
    const msDate = 1714156215000;
    const isoDate = msToIsoDate(msDate);
    expect(isoDate).toEqual('2024-04-26T18:30:15Z'); // Ends by Z because CI seems to be in UTC timezone
  });
});
