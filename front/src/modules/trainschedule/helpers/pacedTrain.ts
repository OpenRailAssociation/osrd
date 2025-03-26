/* eslint-disable import/prefer-default-export */
import type { PacedTrainWithDetails } from '../components/Timetable/types';

export const getOccurrencesNb = ({ timeWindow, interval }: PacedTrainWithDetails['paced']) => {
  if (interval.ms === 0) {
    throw new Error('Interval cannot be 0');
  }
  return Math.ceil(timeWindow.ms / interval.ms);
};
