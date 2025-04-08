/* eslint-disable import/prefer-default-export */
import type { PacedTrainWithDetails } from '../components/Timetable/types';

export const getOccurrencesNb = ({ duration, step }: PacedTrainWithDetails['paced']) => {
  if (step.ms === 0) {
    throw new Error('Step cannot be 0');
  }
  return Math.ceil(duration.ms / step.ms);
};
