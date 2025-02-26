// Constants for expected train counts
export const TOTAL_TRAINS = 21;
// TODO Paced train - update these constant in https://github.com/OpenRailAssociation/osrd/issues/10615
// While the back end for paced trains isn't ready, 3 paced trains are hardcoded and
// added to the list of train schedules for testing purposes.
// These 3 paced trains are copy of the first train schedule in the list (1 valid, 1 not invalid, 1 not honored).
export const TOTAL_PACED_TRAINS = 4;
export const DUPLICATED_PACED_TRAIN = 1;
export const TOTAL_PACED_TRAINS_WITH_DUPLICATE = TOTAL_PACED_TRAINS + DUPLICATED_PACED_TRAIN;
export const TOTAL_ITEMS = TOTAL_TRAINS + TOTAL_PACED_TRAINS;
export const VALID_PACED_TRAINS = 3;
const INVALID_PACED_TRAINS = 1;
export const NOT_HONORED_PACED_TRAINS = 1;
export const NAME_FILTERED_ITEMS = 1;
export const LABEL_FILTERED_ITEMS = 1;
export const ROLLING_STOCK_FILTERED_ITEMS = 7;
export const VALID_TRAINS = 17;
export const VALID_ITEMS = VALID_TRAINS + VALID_PACED_TRAINS;
export const INVALID_TRAINS = 4;
export const INVALID_ITEMS = INVALID_TRAINS + INVALID_PACED_TRAINS;
export const HONORED_TRAINS = 14;
const HONORED_PACED_TRAINS = 2;
export const HONORED_ITEMS = HONORED_TRAINS + HONORED_PACED_TRAINS;
export const NOT_HONORED_TRAINS = 3;
export const NOT_HONORED_ITEMS = NOT_HONORED_TRAINS + NOT_HONORED_PACED_TRAINS;
export const VALID_AND_HONORED_TRAINS = 14;
export const INVALID_AND_NOT_HONORED_TRAINS = 0;
const PACED_TRAINS_WITH_NO_SPEED_LIMIT_TAG = 2;
const TRAINS_WITH__NO_SPEED_LIMIT_TAG = 10;
export const ITEMS_WITH_NO_SPEED_LIMIT_TAG =
  PACED_TRAINS_WITH_NO_SPEED_LIMIT_TAG + TRAINS_WITH__NO_SPEED_LIMIT_TAG;

export const DUPLICATED_PACED_TRAIN_DELTA = 5;
export const DUPLICATED_PACED_TRAIN_INDEX = 1;
