import type { BrokenLinking, Linking } from '@osrd-project/ui-charts';

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

import type { MovableOccupancyZone } from './zones';

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
 * Builds the linkings to draw in a deployed waypoint.
 *
 * A linking is anchored on the zone where the source train ends its path, and on the one where the
 * target train starts its. When both are there and still linkable, the linking is drawn between
 * them; otherwise it is broken, and each of its ends present in the waypoint gets a badge pointing
 * to its missing partner.
 *
 * Suggested linkings are the possible ones the user has not created yet: they are left out unless
 * the linking mode is on.
 */
export default function buildWaypointLinkings({
  zones,
  possibleLinkings,
  existingLinkings,
  trainNames,
  showSuggestions,
}: {
  zones: MovableOccupancyZone[];
  possibleLinkings: Map<TrainId, TrainId>;
  existingLinkings: ExistingLinking[];
  trainNames: (trainId: TrainId) => string | undefined;
  showSuggestions: boolean;
}): { linkings: PositionedLinking[]; brokenLinkings: BrokenLinking[] } {
  // Index the trains whose path ends in this waypoint, and those whose path starts in it:
  const arrivals = new Map<TrainId, MovableOccupancyZone>();
  const departures = new Map<TrainId, MovableOccupancyZone>();
  for (const zone of zones) {
    if (zone.blockType === 'incoming') arrivals.set(zone.trainId, zone);
    if (zone.blockType === 'outgoing') departures.set(zone.trainId, zone);
  }

  const linkings: PositionedLinking[] = [];
  const brokenLinkings: BrokenLinking[] = [];
  // A train may only be the source of one linking, and the target of one other:
  const linkedSources = new Set<TrainId>();
  const linkedTargets = new Set<TrainId>();

  // Draw every existing linking, or break it when its ends cannot be linked anymore:
  for (const { id, source, target } of existingLinkings) {
    linkedSources.add(source);
    linkedTargets.add(target);

    const arrival = arrivals.get(source);
    const departure = departures.get(target);
    // The linking happens in another waypoint:
    if (!arrival && !departure) continue;

    const linkingId = formatLinkingId({ linkingId: id });

    if (arrival && departure && possibleLinkings.get(source) === target) {
      linkings.push({
        id: linkingId,
        targetTrainId: target,
        trackId: arrival.trackId,
        startTime: arrival.endTime,
        endTime: departure.startTime,
      });
      continue;
    }

    const targetName = trainNames(target);
    if (arrival && targetName) {
      brokenLinkings.push({
        id: linkingId,
        trackId: arrival.trackId,
        direction: 'forward',
        time: arrival.endTime,
        name: targetName,
      });
    }
    const sourceName = trainNames(source);
    if (departure && sourceName) {
      brokenLinkings.push({
        id: linkingId,
        trackId: departure.trackId,
        direction: 'backward',
        time: departure.startTime,
        name: sourceName,
      });
    }
  }

  // Suggest the possible linkings which do not exist yet:
  if (showSuggestions) {
    for (const [source, target] of possibleLinkings) {
      if (linkedSources.has(source) || linkedTargets.has(target)) continue;
      const arrival = arrivals.get(source);
      const departure = departures.get(target);
      if (!arrival || !departure) continue;

      linkings.push({
        id: formatLinkingId({ source, target }),
        targetTrainId: target,
        trackId: arrival.trackId,
        startTime: arrival.endTime,
        endTime: departure.startTime,
        suggested: true,
      });
    }
  }

  return { linkings, brokenLinkings };
}
