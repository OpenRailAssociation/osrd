import type { TFunction } from 'i18next';

import type { TimetableItemRoundTripGroups } from 'applications/operationalStudies/types';
import {
  getInvalidStepLabel,
  checkRoundTripCompatible,
  getStationFromOps,
} from 'applications/operationalStudies/utils';
import type { OperationalPoint, TrainSchedule, RoundTrips } from 'common/api/osrdEditoastApi';
import { isPacedTrain } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemWithPathOps } from 'reducers/osrdconf/types';
import { addDurationToDate, Duration } from 'utils/duration';

import type { PairingItem } from './types';

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
        !('operational_point' in step.location)
          ? t('requestedPointUnknown')
          : getInvalidStepLabel(step.location.operational_point)
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
    interval: isPacedTrain(item) ? Duration.parse(item.paced.interval) : null,
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

export const formatPairingItems = (
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

const getItemInitialStatus = (itemRawId: number, roundTrips: RoundTrips) => {
  let initialStatus: 'oneWays' | 'roundTrips' | 'todo' = 'todo';
  if (roundTrips.one_ways?.includes(itemRawId)) {
    initialStatus = 'oneWays';
  } else if (roundTrips.round_trips?.flat().includes(itemRawId)) {
    initialStatus = 'roundTrips';
  }
  return initialStatus;
};

export const buildRoundTripsPayload = (pairingItems: PairingItem[], roundTrips: RoundTrips) => {
  const idsToDelete: number[] = [];
  const oneWaysIds: number[] = [];
  const roundTripsIds: number[][] = [];

  for (const item of pairingItems) {
    const initialStatus = getItemInitialStatus(item.id, roundTrips);

    if (
      item.status === 'roundTrips' &&
      initialStatus !== item.status &&
      !roundTripsIds.flat().includes(item.id)
    ) {
      roundTripsIds.push([item.id, item.pairedItemId]);
    }
    if (item.status === 'oneWays' && initialStatus !== item.status) {
      oneWaysIds.push(item.id);
    }
    if (item.status === 'todo' && initialStatus !== item.status) {
      idsToDelete.push(item.id);
    }
  }

  return { idsToDelete, oneWaysIds, roundTripsIds };
};
