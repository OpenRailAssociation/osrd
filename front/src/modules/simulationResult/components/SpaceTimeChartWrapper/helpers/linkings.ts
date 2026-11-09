import type { BrokenLinking, Linking } from '@osrd-project/ui-charts';
import { sortBy } from 'lodash';

import type {
  LinkingOccurrenceId,
  PostTrainSchedulesLinkingsApiResponse,
} from 'common/api/osrdEditoastApi';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  extractEditoastIdFromTrainId,
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  formatEditoastIdToExceptionId,
  formatEditoastIdToIndexedOccurrenceId,
  formatEditoastIdToTrainScheduleId,
  isAddedExceptionId,
  isIndexedOccurrenceId,
  isTrainId,
} from 'utils/trainId';

import type { PossibleLinkings } from './computePossibleLinkings';
import { getOffsetInPattern, type MovableOccupancyZone } from './zones';

/** A linking stored by editoast, whose ends have been converted to front train IDs. */
export type ExistingLinking = {
  id: number;
  source: TrainId;
  target: TrainId;
};

/** What a linking drawn in a TOD refers to: an existing one, or a pair the user may link. */
export type LinkingReference = { linkingId: number } | { source: TrainId; target: TrainId };

/** A linking placed in a TOD, which will take the colors of its target train. */
export type PositionedLinking = Omit<Linking, 'colors'> & { targetTrainId: TrainId };

/** A badge placed in a TOD on one end of a broken linking, which will name the train it misses. */
export type PositionedBrokenLinking = Omit<BrokenLinking, 'name'> & { trainId: TrainId };

export function formatTrainIdToLinkingOccurrence(trainId: TrainId): LinkingOccurrenceId {
  const trainScheduleId = extractEditoastIdFromTrainId(trainId);
  if (isIndexedOccurrenceId(trainId)) {
    return {
      type: 'paced_occurrence',
      train_schedule_id: trainScheduleId,
      occurrence_index: extractOccurrenceIndexFromOccurrenceId(trainId),
    };
  }
  if (isAddedExceptionId(trainId)) {
    return {
      type: 'added_exception',
      train_schedule_id: trainScheduleId,
      added_exception_id: extractExceptionIdFromOccurrenceId(trainId),
    };
  }
  return { type: 'unique', train_schedule_id: trainScheduleId };
}

export function parseLinkingOccurrence(occurrence: LinkingOccurrenceId): TrainId {
  const trainScheduleId = occurrence.train_schedule_id;
  switch (occurrence.type) {
    case 'paced_occurrence':
      return formatEditoastIdToIndexedOccurrenceId({
        trainScheduleId,
        occurrenceIndex: occurrence.occurrence_index,
      });
    case 'added_exception':
      return formatEditoastIdToExceptionId({
        trainScheduleId,
        exceptionId: occurrence.added_exception_id,
      });
    case 'unique':
      return formatEditoastIdToTrainScheduleId(trainScheduleId);
  }
}

/** Converts the linkings returned by editoast, whose ends it reads as front train IDs. */
export function parseLinkings(linkings: PostTrainSchedulesLinkingsApiResponse): ExistingLinking[] {
  return linkings.map(({ id, source, target }) => ({
    id,
    source: parseLinkingOccurrence(source),
    target: parseLinkingOccurrence(target),
  }));
}

export function formatLinkingId(reference: LinkingReference): string {
  return JSON.stringify(reference);
}

export function parseLinkingId(linkingId: string): LinkingReference {
  let reference: unknown;
  try {
    reference = JSON.parse(linkingId);
  } catch (err) {
    throw new Error('Malformed linking ID: invalid JSON', { cause: err });
  }
  if (!reference || typeof reference !== 'object') {
    throw new Error('Malformed linking ID: invalid fields');
  }
  if ('linkingId' in reference && typeof reference.linkingId === 'number') {
    return { linkingId: reference.linkingId };
  }
  if (
    'source' in reference &&
    typeof reference.source === 'string' &&
    isTrainId(reference.source) &&
    'target' in reference &&
    typeof reference.target === 'string' &&
    isTrainId(reference.target)
  ) {
    return { source: reference.source, target: reference.target };
  }
  throw new Error('Malformed linking ID: invalid fields');
}

/**
 * Builds a linking from an arrival of the source to the next departure of the target. In an hourly
 * pattern, that departure may be on the next repetition. Returns nothing when the target does not
 * depart after the arrival.
 *
 * @param id of the linking, shared by all its repetitions.
 * @param target the train which starts its path after the source.
 * @param arrival a zone where the source ends its path.
 * @param targetDepartures the zones where the target starts its path, in time order.
 */
export function linkToNextDeparture({
  id,
  target,
  arrival,
  targetDepartures,
}: {
  id: string;
  target: TrainId;
  arrival: MovableOccupancyZone;
  targetDepartures: MovableOccupancyZone[];
}): PositionedLinking | undefined {
  const nextDeparture = targetDepartures.find(({ startTime }) => startTime >= arrival.endTime);
  if (!nextDeparture) return undefined;
  return {
    id,
    targetTrainId: target,
    trackId: arrival.trackId,
    startTime: arrival.endTime,
    endTime: nextDeparture.startTime,
  };
}

/**
 * Builds the linkings to draw in a deployed waypoint.
 *
 * A linking is anchored on the zone where the source train ends its path, and on the one where the
 * target train starts its. When both are there and still linkable, the linking is drawn between
 * them; otherwise it is broken, and each of its ends present in the waypoint gets a badge pointing
 * to its missing partner.
 *
 * Suggested linkings are the possible ones the user has not created yet: they are left out unless
 * the linking mode is on.
 *
 * In an hourly pattern, the zones are repeated, a train having one by repetition: its linkings are
 * built on each of them, all sharing the ID of the linking they repeat. A suggested linking is only
 * drawn on the repetitions it is possible on. An existing one is drawn on all of them as long as
 * one repetition allows it, the conflicts telling where another train breaks it.
 *
 * @param hourlyPatternDuration in ms, nil in a calendar timetable.
 */
export default function buildWaypointLinkings({
  zones,
  possibleLinkings,
  existingLinkings,
  showSuggestions,
  hourlyPatternDuration,
}: {
  zones: MovableOccupancyZone[];
  possibleLinkings: PossibleLinkings;
  existingLinkings: ExistingLinking[];
  showSuggestions: boolean;
  hourlyPatternDuration?: number;
}): { linkings: PositionedLinking[]; brokenLinkings: PositionedBrokenLinking[] } {
  // Group the zones by train, in time order: those where a train ends its path, and those where a
  // train starts it.
  const arrivals = new Map<TrainId, MovableOccupancyZone[]>();
  const departures = new Map<TrainId, MovableOccupancyZone[]>();
  for (const zone of sortBy(zones, 'startTime')) {
    if (zone.blockType === 'via') continue;
    const zonesByTrain = zone.blockType === 'incoming' ? arrivals : departures;
    zonesByTrain.set(zone.trainId, [...(zonesByTrain.get(zone.trainId) ?? []), zone]);
  }

  const linkings: PositionedLinking[] = [];
  const brokenLinkings: PositionedBrokenLinking[] = [];
  // A train may only be the source of one linking, and the target of one other:
  const linkedSources = new Set<TrainId>();
  const linkedTargets = new Set<TrainId>();

  // Draw every existing linking, or break it when its ends cannot be linked anymore:
  for (const { id, source, target } of existingLinkings) {
    linkedSources.add(source);
    linkedTargets.add(target);

    const sourceArrivals = arrivals.get(source) ?? [];
    const targetDepartures = departures.get(target) ?? [];
    // The linking happens in another waypoint:
    if (!sourceArrivals.length && !targetDepartures.length) continue;

    const linkingId = formatLinkingId({ linkingId: id });

    if (possibleLinkings.get(source)?.target === target) {
      for (const arrival of sourceArrivals) {
        const linking = linkToNextDeparture({ id: linkingId, target, arrival, targetDepartures });
        if (linking) linkings.push(linking);
      }
      continue;
    }

    for (const arrival of sourceArrivals) {
      brokenLinkings.push({
        id: linkingId,
        trackId: arrival.trackId,
        direction: 'forward',
        time: arrival.endTime,
        trainId: target,
      });
    }
    for (const departure of targetDepartures) {
      brokenLinkings.push({
        id: linkingId,
        trackId: departure.trackId,
        direction: 'backward',
        time: departure.startTime,
        trainId: source,
      });
    }
  }

  // Suggest the possible linkings which do not exist yet:
  if (showSuggestions) {
    for (const [source, { target, sourceOffsets }] of possibleLinkings) {
      if (linkedSources.has(source) || linkedTargets.has(target)) continue;

      for (const arrival of arrivals.get(source) ?? []) {
        const offset = getOffsetInPattern(arrival.repeatOffset, hourlyPatternDuration);
        if (!sourceOffsets.has(offset)) continue;
        const linking = linkToNextDeparture({
          id: formatLinkingId({ source, target }),
          target,
          arrival,
          targetDepartures: departures.get(target) ?? [],
        });
        if (linking) linkings.push({ ...linking, suggested: true });
      }
    }
  }

  return { linkings, brokenLinkings };
}
