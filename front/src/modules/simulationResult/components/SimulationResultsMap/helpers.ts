/* eslint-disable import/prefer-default-export */

// TODO: fix warped map - check if this is the correct data type to use
// type InterpolatedTrain = {
//   name: string;
//   id: number;
//   trainId: number;
//   head_positions?: PositionSpeedTime;
//   tail_positions?: PositionSpeedTime;
//   speeds?: PositionSpeedTime;
// };

// TODO: fix warped map - probably remove this function and use finalOutput as key ?
export function getRegimeKey() {
  return 'base';
}
