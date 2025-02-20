import type { PacedTrainSettings } from '../../utils/types';

export const DEFAULT_PACED_TRAIN_SETTINGS: Pick<
  PacedTrainSettings,
  'timeRangeDuration' | 'cadence'
> = {
  timeRangeDuration: '120',
  cadence: '60',
};

export const PACED_TRAIN_SETTINGS_TEST: Pick<PacedTrainSettings, 'timeRangeDuration' | 'cadence'> =
  {
    timeRangeDuration: '180',
    cadence: '30',
  };

export const NEW_PACED_TRAIN_SETTINGS: PacedTrainSettings = {
  name: 'Paced train test',
  startTime: '08:35:40',
  timeRangeDuration: '150',
  cadence: '20',
};
