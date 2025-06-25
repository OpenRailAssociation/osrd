import { readFile } from 'node:fs/promises';

import { describe, expect, test, vi } from 'vitest';

import { convertNgeDtoToOsrd } from 'applications/operationalStudies/components/MacroEditor/ngeToOsrd';
import type { NetzgrafikDto } from 'applications/operationalStudies/components/NGE/types';

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(path, import.meta.url).pathname, 'utf-8'));
}

vi.setSystemTime(new Date('2025-06-25T13:00:00.000Z'));

describe('convertNgeDtoToOsrd', () => {
  test.each(['sharedSource', 'sharedTarget'])('outOfOrderSourceTarget-$0', async (name) => {
    const dto = (await readJsonFile(`./outOfOrderSourceTarget-${name}-dto.json`)) as NetzgrafikDto;
    const expected = await readJsonFile(`./outOfOrderSourceTarget-output.json`);
    const result = convertNgeDtoToOsrd(dto);
    // Go through JSON encoding to discard undefined fields
    expect(JSON.parse(JSON.stringify(result))).toEqual(expected);
  });
});
