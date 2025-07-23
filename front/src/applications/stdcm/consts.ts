import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import type { ConsistErrors } from './types';

export const STDCM_REQUEST_STATUS = Object.freeze({
  idle: 'IDLE',
  pending: 'PENDING',
  success: 'SUCCESS',
  rejected: 'REJECTED',
  canceled: 'CANCELED',
  noresults: 'NORESULTS',
  pending_additional: 'PENDING_ADDITIONAL',
});

export const STDCM_TRAIN_ID = -10;
export const STDCM_TRAIN_TIMETABLE_ID = formatEditoastIdToTrainScheduleId(STDCM_TRAIN_ID);

export const consistErrorFields: (keyof ConsistErrors)[] = ['totalMass', 'totalLength', 'maxSpeed'];
