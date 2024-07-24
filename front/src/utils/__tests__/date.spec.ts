import {
  dateTimeToIso,
  isoDateToMs,
  formatToIsoDate,
  serializeDateTimeWithoutYear,
  parseDateTime,
} from 'utils/date';

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

describe('formatToIsoDate', () => {
  it('should return the date in ISO 8601', () => {
    const msDate = 1714156215000;
    const isoDate = formatToIsoDate(msDate);
    expect(isoDate).toEqual('2024-04-26T18:30:15Z'); // Ends by Z because CI seems to be in UTC timezone
  });
});

describe('parseDateTime', () => {
  it('should parse a valid date-time string', () => {
    const input = '18/07/2024 03:16:30';
    const result = parseDateTime(input);
    expect(result).toBeInstanceOf(Date);
  });

  it('should return null for an invalid date-time string', () => {
    const input = 'invalid date';
    const result = parseDateTime(input);
    expect(result).toBeNull();
  });
});

describe('serializeDateTimeWithoutYear', () => {
  it('should return the date without the year for a valid Date object', () => {
    const inputDate = new Date('2024-07-18T03:16:30Z');
    const result = serializeDateTimeWithoutYear(inputDate);
    expect(result).toEqual('18/07 03:16:30');
  });

  it('should return an empty string for an invalid Date object', () => {
    const inputDate = new Date(NaN);
    const result = serializeDateTimeWithoutYear(inputDate);
    expect(result).toEqual('Invalid Date');
  });
});
