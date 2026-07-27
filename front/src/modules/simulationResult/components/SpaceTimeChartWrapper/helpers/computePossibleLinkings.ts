import { groupBy, isNil } from 'lodash';

import type { TrainId } from 'reducers/osrdconf/types';

export type LinkableOccupancy = {
  trainId: TrainId;
  /** Nil when the occupied track is unknown. */
  localTrackName?: string | null;
  /** Times in ms. */
  startTime: number;
  endTime: number;
  /**
   * Role of the block in the train path: `incoming` when the train ends its path here, `outgoing`
   * when it starts it here, and `via` in between, be it a stop or a track the train only passes by.
   */
  blockType: 'incoming' | 'outgoing' | 'via';
  /**
   * Whether the train stands still on the track: it stops at the end of its path for an `incoming`
   * block, and starts its path at a null speed for an `outgoing` one. Not read on `via` blocks.
   */
  isStop: boolean;
  active: boolean;
};

/**
 * One end of an occupancy block, as scanned along the time axis. A block of no duration — a train
 * crossing the track without stopping — yields a single `instant` endpoint instead of a pair.
 */
type BlockEndpoint = {
  time: number;
  type: 'start' | 'end' | 'instant';
  occupancy: LinkableOccupancy;
};

/**
 * At equal times, ends are scanned before instants, and instants before starts, so that back to
 * back occupancies do not read as an overlap while a train crossing the track still breaks a
 * pending linking.
 */
const ENDPOINT_RANK: Record<BlockEndpoint['type'], number> = { end: 0, instant: 1, start: 2 };

/**
 * A linking is possible between two occupancies of a same track when the first train ends its path
 * there, the second one starts its path there, both stand still, and nothing else occupies the
 * track in between.
 *
 * Both ends of a linking may be a unique train as well as an occurrence of a paced train, hence the
 * `TrainId` keys.
 *
 * Rather than comparing every pair of occupancies, the blocks of a track are cut into endpoints,
 * sorted by time, then scanned once: a linking is found when the end of an incoming block is
 * immediately followed by the start of an outgoing one, no other block being open in between.
 *
 * @returns the possible linkings, from the source (arriving) train to the target (departing) one.
 * Since no other train may occupy the track in between, a train can be the source of at most one
 * linking, and the target of at most one other.
 */
export default function computePossibleLinkings(
  occupancies: LinkableOccupancy[]
): Map<TrainId, TrainId> {
  const linkings = new Map<TrainId, TrainId>();

  const scannableOccupancies = occupancies.filter(
    (occupancy) =>
      occupancy.active &&
      // Trains whose track is unknown cannot be proven to occupy the same one:
      !isNil(occupancy.localTrackName)
  );

  for (const trackOccupancies of Object.values(groupBy(scannableOccupancies, 'localTrackName'))) {
    const endpoints = trackOccupancies.flatMap<BlockEndpoint>((occupancy) =>
      occupancy.startTime === occupancy.endTime
        ? [{ time: occupancy.startTime, type: 'instant', occupancy }]
        : [
            { time: occupancy.startTime, type: 'start', occupancy },
            { time: occupancy.endTime, type: 'end', occupancy },
          ]
    );
    endpoints.sort((a, b) => a.time - b.time || ENDPOINT_RANK[a.type] - ENDPOINT_RANK[b.type]);

    let linkingSource: LinkableOccupancy | null = null;
    let openBlocks = 0;

    for (const { type, occupancy } of endpoints) {
      const isLinkingArrival =
        type === 'end' && occupancy.blockType === 'incoming' && occupancy.isStop;
      const isLinkingDeparture =
        type === 'start' && occupancy.blockType === 'outgoing' && occupancy.isStop;
      const isTrackFree = openBlocks === 0;

      if (isLinkingArrival) {
        linkingSource = occupancy;
      } else if (isLinkingDeparture && linkingSource && isTrackFree) {
        linkings.set(linkingSource.trainId, occupancy.trainId);
        linkingSource = null;
      } else {
        // Any other block reaching the track discards the pending linking source:
        linkingSource = null;
      }

      // An instant block covers no interval, so it never opens: it only discards the source above.
      if (type !== 'instant') openBlocks += type === 'start' ? 1 : -1;
    }
  }

  return linkings;
}
