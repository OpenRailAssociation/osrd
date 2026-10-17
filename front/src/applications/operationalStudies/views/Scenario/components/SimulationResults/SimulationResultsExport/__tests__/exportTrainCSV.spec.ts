import { readFile } from 'node:fs/promises';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  OperationalPointWithTimeAndSpeed,
  ElectrificationRange,
} from 'applications/operationalStudies/types';
import type {
  CoreSpeedLimitProperties,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdconf/types';

import exportTrainCSV from '../exportTrainCSV';

async function readLocalFile(path: string): Promise<string> {
  return await readFile(new URL(path, import.meta.url).pathname, 'utf-8');
}

describe('exportTrainCSV', () => {
  let downloadedContent = '';
  let downloadedFilename = '';

  beforeEach(() => {
    // Fake today's date as it is present in the csv's header
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    dayjs.extend(utc);

    // Fake the download click to store the downloaded csv in downloadedFilename and downloadedContent instead
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloadedFilename = this.download;
      downloadedContent = decodeURIComponent(this.getAttribute('href')!);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('exports the expected CSV for a simulated train', async () => {
    const trainStartTime = Date.UTC(2024, 0, 1, 10);

    const finalOutput: Partial<SimulationResponseSuccess['final_output']> = {
      positions: [0, 100_000, 100_000, 300_000],
      speeds: [10, 20, 0, 15],
      times: [0, 10_000, 20_000, 30_000],
    };

    const mrsp: CoreSpeedLimitProperties = {
      boundaries: [200_000, 230_000], // 200 is interpolated, 230 is already present due to op
      values: [{ speed: 25 }, { speed: 15 }, { speed: 25 }],
    };

    const simulatedTrain: Partial<SimulationResponseSuccess> = {
      final_output: finalOutput as SimulationResponseSuccess['final_output'],
      mrsp,
    };

    const operationalPoints: OperationalPointWithTimeAndSpeed[] = [
      {
        id: 'op-1',
        name: 'Op A',
        position: 0,
        speed: 0,
        time: new Date(trainStartTime),
        line_code: 10,
        line_name: '10n',
        track_number: 1,
        track_name: 'A',
      },
      {
        id: 'op-2',
        name: 'Op B',
        position: 100,
        speed: 0,
        time: new Date(trainStartTime + 19_000),
        line_code: 20,
        line_name: '20n',
        track_number: 2,
        track_name: 'V2',
        secondary_code: 'BV',
      },
      {
        id: 'op-3',
        name: 'Op C',
        position: 230,
        speed: 0,
        time: new Date(trainStartTime + 24_000),
        line_code: 10,
        line_name: '10m',
        track_number: 1,
        track_name: 'UNIQUE',
        secondary_code: 'AT',
      },
    ];

    const electrificationRanges: ElectrificationRange[] = [
      {
        start: 200,
        stop: 300,
        electrificationUsage: {
          type: 'electrification',
          voltage: '25000V',
          electrical_profile_type: 'profile',
          profile: 'ProfileA',
          handled: true,
        },
      },
    ];

    const train: Partial<Train> = {
      train_name: 'Test train',
      start_time: trainStartTime,
    };

    exportTrainCSV(
      simulatedTrain as SimulationResponseSuccess,
      operationalPoints,
      electrificationRanges,
      train as Train
    );

    expect(downloadedFilename).toBe('export-Test train-final_output.csv');

    const expectedCsv = await readLocalFile('./expectedExport.csv');
    expect(downloadedContent).toBe(`data:text/csv;charset=utf-8,${expectedCsv}`);
  });
});
