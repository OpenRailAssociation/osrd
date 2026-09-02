import { isNil } from 'lodash';

import type { PacedTrainException, PathItemRelativeLocation } from 'common/api/osrdEditoastApi';

import type { TrainSpaceTimeData } from '../../../types';
import type { LinkableOccupancy } from './computePossibleLinkings';

/**
 * Extracts from a train occupancy the data needed to compute the linkings of its track.
 *
 * The occupancy is located relatively to the path items of the occurrence, which are the ones of
 * its train schedule, unless an exception changed its path.
 */
export default function getLinkableOccupancyData(
  location: PathItemRelativeLocation,
  train: Pick<
    TrainSpaceTimeData,
    'originPathItem' | 'destinationPathItem' | 'schedule' | 'initialSpeed'
  >,
  exception?: PacedTrainException
): Pick<LinkableOccupancy, 'blockType' | 'isStop' | 'active'> {
  const exceptionPathAndSchedule = exception?.path_and_schedule;
  const path = exceptionPathAndSchedule?.path;
  const originPathItemId = path?.at(0)?.id ?? train.originPathItem.id;
  const destinationPathItemId = path?.at(-1)?.id ?? train.destinationPathItem.id;

  let blockType: LinkableOccupancy['blockType'] = 'via';
  if (location.type === 'exact_path_item') {
    if (location.path_item_id === originPathItemId) blockType = 'outgoing';
    else if (location.path_item_id === destinationPathItemId) blockType = 'incoming';
  }

  const schedule = exceptionPathAndSchedule?.schedule ?? train.schedule;
  const hasStop =
    location.type === 'exact_path_item' &&
    !!schedule?.some(({ at, stop_for }) => at === location.path_item_id && !isNil(stop_for));
  const initialSpeed = exception?.initial_speed?.value ?? train.initialSpeed;
  const isStop = hasStop || (blockType === 'outgoing' && !initialSpeed);

  return { blockType, isStop, active: !exception?.disabled };
}
