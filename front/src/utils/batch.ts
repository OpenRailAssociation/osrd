/* eslint-disable import/prefer-default-export */

import type { TimetableItemId } from 'reducers/osrdconf/types';

export const getBatchPackage = (
  currentIndex: number,
  items: TimetableItemId[],
  batchSize: number
) => items.slice(currentIndex, currentIndex + batchSize);
