import type { TFunction } from 'i18next';

import type { TrainScheduleRoundTripGroups } from 'applications/operationalStudies/types';
import {
  getInvalidStepLabel,
  checkRoundTripCompatible,
  getStationFromOps,
} from 'applications/operationalStudies/utils';
import type { OperationalPoint, TrainSchedule, RoundTrips } from 'common/api/osrdEditoastApi';
import { isPacedTrain } from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithPathOps } from 'reducers/osrdconf/types';
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
        step.location.type === 'track_offset'
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
  trainSchedule: TrainScheduleWithPathOps,
  status: 'todo' | 'oneWays' | 'roundTrips',
  t: TFunction<'operational-studies', 'main'>
): PairingItem => {
  const stepLabels = getStepLabels(
    trainSchedule.pathOps,
    trainSchedule.path,
    trainSchedule.schedule,
    t
  );

  const arrivalStepId = trainSchedule.path.at(-1)?.id;
  const destinationSchedule = trainSchedule.schedule?.find(
    (scheduleStep) => scheduleStep.at === arrivalStepId
  );
  const requestedArrivalTime = destinationSchedule?.arrival
    ? addDurationToDate(
        new Date(trainSchedule.start_time),
        Duration.parse(destinationSchedule.arrival)
      )
    : null;

  return {
    id: trainSchedule.id,
    name: trainSchedule.train_name,
    category: trainSchedule.category,
    interval: isPacedTrain(trainSchedule) ? Duration.parse(trainSchedule.paced.interval) : null,
    origin: stepLabels.at(0)!,
    stops: stepLabels.slice(1, -1),
    destination: stepLabels.at(-1)!,
    startTime: new Date(trainSchedule.start_time),
    requestedArrivalTime,
    ...(status === 'roundTrips'
      ? {
          status: 'roundTrips',
          pairedItemId: trainSchedule.id,
          isValidPair: false,
        }
      : { status }),
  };
};

export const formatPairingItems = (
  roundTripGroups: TrainScheduleRoundTripGroups,
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
