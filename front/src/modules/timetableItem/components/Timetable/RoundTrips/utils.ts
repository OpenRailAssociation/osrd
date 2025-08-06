import type { TFunction } from 'i18next';

import type { TimetableItemRoundTripGroups } from 'applications/operationalStudies/types';
import {
  getInvalidStepLabel,
  checkRoundTripCompatible,
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

const formatBasePairingItem = (
  item: TimetableItemWithPathOps,
  status: 'todo' | 'oneWays' | 'roundTrips',
  t: TFunction<'operational-studies', 'main'>
): PairingItem => {
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
    ...(status === 'roundTrips'
      ? {
          status: 'roundTrips',
          pairedItemId: item.id,
          isValidPair: false,
        }
      : { status }),
  };
};

const formatPairingItems = (
  roundTripGroups: TimetableItemRoundTripGroups,
  t: TFunction<'operational-studies', 'main'>
): PairingItem[] => {
  const todoItems = roundTripGroups.others.map((item) => formatBasePairingItem(item, 'todo', t));
  const oneWayItems = roundTripGroups.oneWays.map((item) =>
    formatBasePairingItem(item, 'oneWays', t)
  );
  const roundTripItems = roundTripGroups.roundTrips.map(([itemA, itemB]) => {
    const formattedItemA = formatBasePairingItem(itemA, 'roundTrips', t);
    const formattedItemB = formatBasePairingItem(itemB, 'roundTrips', t);
    const isValidPair = checkRoundTripCompatible(itemA, itemB);
    return [
      {
        ...formattedItemA,
        pairedItemId: formattedItemB.id,
        isValidPair,
      },
      {
        ...formattedItemB,
        pairedItemId: formattedItemA.id,
        isValidPair,
      },
    ];
  });

  return [...todoItems, ...oneWayItems, ...roundTripItems]
    .flat()
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
};

export default formatPairingItems;
