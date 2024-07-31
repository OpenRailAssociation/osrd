/* eslint-disable import/prefer-default-export */

export const getBatchPackage = (currentIndex: number, items: number[], batchSize: number) =>
  items.slice(currentIndex, currentIndex + batchSize);
