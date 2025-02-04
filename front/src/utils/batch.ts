/* eslint-disable import/prefer-default-export */

import type { TrainId } from 'reducers/osrdconf/types';

export const getBatchPackage = (currentIndex: number, items: TrainId[], batchSize: number) =>
  items.slice(currentIndex, currentIndex + batchSize);
