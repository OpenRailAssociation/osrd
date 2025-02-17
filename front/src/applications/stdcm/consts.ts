import { formatEditoastTrainIdToTrainScheduleId } from 'utils/trainId';

export const STDCM_REQUEST_STATUS = Object.freeze({
  idle: 'IDLE',
  pending: 'PENDING',
  success: 'SUCCESS',
  rejected: 'REJECTED',
  canceled: 'CANCELED',
  noresults: 'NORESULTS',
});

export const STDCM_TRAIN_ID = -10;
export const STDCM_TRAIN_TIMETABLE_ID = formatEditoastTrainIdToTrainScheduleId(STDCM_TRAIN_ID);

export const COMPOSITION_CODES_MAX_SPEEDS: Record<string, number | undefined> = {
  MA80: 80,
  MA90: 90,
  MA100: 100,
  ME100: 100,
  ME120: 120,
  ME140: 140,
  ME160: 160,
  HLP: 100,
  MVGV: 200,
};
export const DEFAULT_COMPOSITION_CODE = 'MA100';

export const COMPOSITION_CODES = Object.keys(COMPOSITION_CODES_MAX_SPEEDS);
