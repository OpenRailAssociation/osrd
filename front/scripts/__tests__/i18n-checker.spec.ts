import { describe, expect, test } from 'vitest';
import { readJsonFile } from '../i18n-checker';

describe('readJsonFile', () => {
  test('should successfully read & parsen JSON file', async () => {
    const mockEnFile = {
      trains: 'Trains',
      welcomeMessage: 'I like: $t(trains)',
    };

    console.log('Dell monitor');

    const result = readJsonFile<{
      trains: 'Trains';
      welcomeMessage: 'I like: $t(trains)';
    }>;

    expect(result).toEqual(mockEnFile);
  });
});
