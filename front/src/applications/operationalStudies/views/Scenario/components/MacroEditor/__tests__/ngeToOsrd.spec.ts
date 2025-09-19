import { readFile } from 'node:fs/promises';

import { describe, expect, test, vi } from 'vitest';

import type { NetzgrafikDto } from '../../NGE/types';
import { convertNgeDtoToOsrd } from '../ngeToOsrd';

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(path, import.meta.url).pathname, 'utf-8'));
}

vi.setSystemTime(new Date('2025-06-25T13:00:00.000Z'));

describe('convertNgeDtoToOsrd', () => {
  test.each(['roundTrip', 'oneWay', 'duplicateTrigrams', 'discontinuousTrainrun'])(
    'ngeToOsrd-inputDto-$0',
    async (name) => {
      const dto = (await readJsonFile(`./ngeToOsrd-inputDto-${name}.json`)) as NetzgrafikDto;
      const expected = await readJsonFile(`./ngeToOsrd-output-${name}.json`);
      const result = convertNgeDtoToOsrd(dto);
      // Go through JSON encoding to discard undefined fields
      expect(JSON.parse(JSON.stringify(result))).toEqual(expected);
    }
  );
});
