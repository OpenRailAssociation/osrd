import {
  generateCodeNumber,
  formatCreationDate,
  getStopDurationTime,
  extractSpeedLimit,
  computeStopDepartureTime,
  addMinutesToTime,
  getStopDurationBetweenTwoPositions,
} from 'applications/stdcm/utils/formatSimulationReportSheet';

describe('generateCodeNumber', () => {
  it('should return a formatted string', () => {
    const codeNumber = generateCodeNumber();
    expect(codeNumber).toMatch(/^\d{2}\d{2}-\d{3}-\d{3}$/);
  });
});

// TODO DROP STDCM V1
describe('formatCreationDate', () => {
  it('should format the date correctly', () => {
    const departure_time = '2024-07-08T10:20:30Z';
    const formattedDate = formatCreationDate(departure_time);
    expect(formattedDate).toEqual({
      day: '08',
      month: '07',
      year: 2024,
      hours: 10,
      minutes: 20,
    });
  });
});

describe('getStopDurationTime', () => {
  it('should return correct time format', () => {
    expect(getStopDurationTime(30)).toBe('30 sec');
    expect(getStopDurationTime(120)).toBe('2 min');
  });
});

describe('extractSpeedLimit', () => {
  it('should extract the speed limit correctly', () => {
    const speedLimitByTag1 = 'Voyageurs 100 - MA100';
    const speedLimitByTag2 = 'Voyageurs';
    expect(extractSpeedLimit(speedLimitByTag1)).toBe('MA100');
    expect(extractSpeedLimit(speedLimitByTag2)).toBe('Voyageurs');
  });
});

describe('computeStopDepartureTime', () => {
  it('should compute stop departure time correctly for a standard time', () => {
    expect(computeStopDepartureTime('10:30', '15:00')).toBe('10:45');
  });
  it('should compute stop departure time correctly when changing days', () => {
    expect(computeStopDepartureTime('23:59', '01:00')).toBe('00:00');
    expect(computeStopDepartureTime('23:59', '02:00')).toBe('00:01');
  });
});

describe('addMinutesToTime', () => {
  it('should should add minutes to time correctly for a standard time', () => {
    expect(addMinutesToTime(0, 5, 30)).toBe('00:35');
    expect(addMinutesToTime(6, 9, 5)).toBe('06:14');
    expect(addMinutesToTime(10, 30, 15)).toBe('10:45');
  });
  it('should should add minutes to time correctly when changing days', () => {
    expect(addMinutesToTime(23, 59, 1)).toBe('00:00');
    expect(addMinutesToTime(23, 45, 30)).toBe('00:15');
  });
});

describe('getStopDurationBetweenTwoPositions', () => {
  it('should return stop duration correctly', () => {
    const trainPositions = [1, 2, 2, 3];
    const trainTimes = [10000, 120000, 180000];
    expect(getStopDurationBetweenTwoPositions(2, trainPositions, trainTimes)).toBe(60000);
    expect(getStopDurationBetweenTwoPositions(1, trainPositions, trainTimes)).toBeNull();
  });
});
