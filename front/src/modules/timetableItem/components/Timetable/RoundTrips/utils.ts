import type { TFunction } from 'i18next';

import {
  getInvalidStepLabel,
  getStationFromOps,
  isOperationalPointReference,
} from 'applications/operationalStudies/utils';
import type { OperationalPoint, PathItemLocation } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithPathOps } from 'reducers/osrdconf/types';
import { addDurationToDate, Duration } from 'utils/duration';
import { isPacedTrainResponseWithPacedTrainId } from 'utils/trainId';

import type { RoundTripsModalColumnsData } from '../types';

const getStepLabels = (
  ops: (OperationalPoint[] | null)[],
  steps: PathItemLocation[],
  t: TFunction<'operational-studies', 'main'>
) =>
  steps.map((step, index) => {
    const pathOp = ops.at(index)!;
    const isExtremity = index === 0 || index === steps.length - 1;

    // If no matching op has been found for this step, it's either a track offset or an invalid step
    if (pathOp.length === 0) {
      return !isOperationalPointReference(step)
        ? t('requestedPointUnknown')
        : getInvalidStepLabel(step);
    }

    const station = getStationFromOps(pathOp);

    // We know we will have a station since we handled the case where pathOp is empty
    const stationName = station!.extensions?.identifier?.name ?? '';

    if (!isExtremity) return stationName;

    return `${stationName} ${station!.extensions?.sncf?.ch ?? ''}`;
  });

const formatPairingItems = (
  items: TimetableItemWithPathOps[],
  t: TFunction<'operational-studies', 'main'>
): RoundTripsModalColumnsData => {
  const sortedItems = items.sort((a, b) =>
    a.train_name.toLowerCase().localeCompare(b.train_name.toLowerCase())
  );

  return sortedItems.reduce<RoundTripsModalColumnsData>(
    (acc, item) => {
      const stepLabels = getStepLabels(item.pathOps, item.path, t);

      const arrivalStepId = item.path.at(-1)?.id;
      const destinationSchedule = item.schedule?.find(
        (scheduleStep) => scheduleStep.at === arrivalStepId
      );
      const requestedArrivalTime = destinationSchedule?.arrival
        ? addDurationToDate(new Date(item.start_time), Duration.parse(destinationSchedule.arrival))
        : null;

      acc.todo.push({
        id: item.id,
        name: item.train_name,
        category: item.category,
        interval: isPacedTrainResponseWithPacedTrainId(item)
          ? Duration.parse(item.paced.interval)
          : null,
        origin: stepLabels.at(0)!,
        stops: stepLabels.slice(1, -1),
        destination: stepLabels.at(-1)!,
        startTime: new Date(item.start_time),
        requestedArrivalTime,
      });
      return acc;
    },
    { todo: [], oneWays: [], roundTrips: [] }
  );
};

export default formatPairingItems;
