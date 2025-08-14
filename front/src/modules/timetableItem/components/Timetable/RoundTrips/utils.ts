import type { TFunction } from 'i18next';

import {
  getInvalidStepLabel,
  getStationFromOps,
  isOperationalPointReference,
} from 'applications/operationalStudies/utils';
import type { OperationalPoint, TrainSchedule } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithPathOps } from 'reducers/osrdconf/types';
import { addDurationToDate, Duration } from 'utils/duration';
import { isPacedTrainResponseWithPacedTrainId } from 'utils/trainId';

import type { PairingItem } from '../types';

const getStepLabels = (
  ops: (OperationalPoint[] | null)[],
  steps: TrainSchedule['path'],
  schedule: TrainSchedule['schedule'],
  t: TFunction<'operational-studies', 'main'>
) =>
  steps.reduce<string[]>((acc, step, index) => {
    const pathOp = ops.at(index)!;
    const isExtremity = index === 0 || index === steps.length - 1;
    const isStop = schedule?.some((s) => s.at === step.id && !!s.stop_for);

    if (!isExtremity && !isStop) return acc;

    // If no matching op has been found for this step, it's either a track offset or an invalid step
    if (pathOp.length === 0) {
      acc.push(
        !isOperationalPointReference(step) ? t('requestedPointUnknown') : getInvalidStepLabel(step)
      );
      return acc;
    }

    const station = getStationFromOps(pathOp);

    // We know we will have a station since we handled the case where pathOp is empty
    const stationName = station!.extensions?.identifier?.name ?? '';

    if (!isExtremity) {
      acc.push(stationName);
      return acc;
    }

    acc.push(`${stationName} ${station!.extensions?.sncf?.ch ?? ''}`);
    return acc;
  }, []);

const formatPairingItems = (
  items: TimetableItemWithPathOps[],
  t: TFunction<'operational-studies', 'main'>
): PairingItem[] => {
  const sortedItems = items.sort((a, b) =>
    a.train_name.toLowerCase().localeCompare(b.train_name.toLowerCase())
  );

  // TODO : handle status with round-trips data in issue https://github.com/OpenRailAssociation/osrd/issues/12376
  return sortedItems.map((item) => {
    const stepLabels = getStepLabels(item.pathOps, item.path, item.schedule, t);

    const arrivalStepId = item.path.at(-1)?.id;
    const destinationSchedule = item.schedule?.find(
      (scheduleStep) => scheduleStep.at === arrivalStepId
    );
    const requestedArrivalTime = destinationSchedule?.arrival
      ? addDurationToDate(new Date(item.start_time), Duration.parse(destinationSchedule.arrival))
      : null;

    return {
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
      status: 'todo',
    };
  });
};

export default formatPairingItems;
