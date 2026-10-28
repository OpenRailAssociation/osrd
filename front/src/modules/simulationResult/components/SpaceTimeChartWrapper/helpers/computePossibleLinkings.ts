import { groupBy } from 'lodash';

import type { TrainId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import { getOffsetInPattern, repeatOccupancyZonesInRange } from './zones';

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
  /** Whether the schedule of the train holds a stop here. Not read on `via` blocks. */
  isStop: boolean;
  active: boolean;
  /**
   * Duration of the service of the train (the one of `paced` on a zone), in ms. Nil for a unique
   * train.
   */
  timeWindow?: number;
};

/** An occupancy as scanned, with the offset of this occurrence of its paced train, in ms. */
type RepeatedOccupancy = LinkableOccupancy & { repeatOffset?: number };

export type PossibleLinking = {
  target: TrainId;
  /**
   * Offsets of the source within the hourly pattern where the linking is possible: another train
   * may pass between the source and the target on some repetitions only. Always {0} in a calendar
   * timetable.
   */
  sourceOffsets: Set<number>;
};

export type PossibleLinkings = Map<TrainId, PossibleLinking>;

/**
 * One end of an occupancy block, as scanned along the time axis. A block of no duration yields a
 * single `instant` endpoint instead of a pair: a train crossing the track, or stopping there for
 * no time at all.
 */
type BlockEndpoint = {
  time: number;
  type: 'start' | 'end' | 'instant';
  occupancy: RepeatedOccupancy;
};

/**
 * At equal times, ends are scanned before instants, and instants before starts, so that back to
 * back occupancies do not read as an overlap while a train crossing the track still breaks a
 * pending linking.
 */
const ENDPOINT_RANK: Record<BlockEndpoint['type'], number> = { end: 0, instant: 1, start: 2 };

/**
 * At equal times and ranks, which happens between blocks of no duration, the arriving train is
 * scanned before the departing one it hands the track over to.
 */
const BLOCK_RANK: Record<LinkableOccupancy['blockType'], number> = {
  incoming: 0,
  via: 1,
  outgoing: 2,
};

/**
 * Whether two trains can be linked in an hourly pattern. The second pattern is only there for the
 * departures after the first one, so the linkings starting in it are skipped. Services of
 * different durations are not linked: which target occurrence follows the source would be unclear.
 */
const isLinkable = (
  source: LinkableOccupancy,
  target: LinkableOccupancy,
  hourlyPatternDuration?: number
) => {
  if (!hourlyPatternDuration) return true;
  const arrivesInFirstPattern = source.endTime >= 0 && source.endTime < hourlyPatternDuration;
  return arrivesInFirstPattern && source.timeWindow === target.timeWindow;
};

/**
 * A linking is possible between two occupancies of a same track when the first train ends its path
 * there, the second one starts its path there, both stand still, and nothing else occupies the
 * track in between.
 *
 * Both ends of a linking may be a unique train as well as an occurrence of a paced train, hence the
 * `TrainId` keys.
 *
 * Rather than comparing every pair of occupancies, the blocks of a track are cut into endpoints,
 * sorted by time, then scanned once: a linking is found when an incoming block ends where an
 * outgoing one starts, no other block being open in between.
 *
 * In an hourly pattern, the occupancies are repeated over two patterns, and only the linkings
 * starting during the first one are kept: the second one only holds the ends of those crossing
 * into the next pattern. Two trains are then linked only if their services have the same duration,
 * since the target occurrence would be ambiguous otherwise.
 *
 * @param occupancies as returned by editoast, one time window by service.
 * @param hourlyPatternDuration in ms, nil in a calendar timetable.
 * @returns the possible linkings, from the source (arriving) train to the target (departing) one.
 * Since no other train may occupy the track in between, a train can be the source of at most one
 * linking, and the target of at most one other.
 */
export default function computePossibleLinkings(
  occupancies: LinkableOccupancy[],
  hourlyPatternDuration?: number
): PossibleLinkings {
  const linkings: PossibleLinkings = new Map();

  const activeOccupancies = occupancies.filter((occupancy) => occupancy.active);
  const scannableOccupancies: RepeatedOccupancy[] = hourlyPatternDuration
    ? repeatOccupancyZonesInRange(activeOccupancies, {
        start: Duration.zero,
        end: new Duration({ milliseconds: 2 * hourlyPatternDuration }),
      })
    : activeOccupancies;

  // All unknown local track names will be grouped and considered as the same track
  for (const trackOccupancies of Object.values(groupBy(scannableOccupancies, 'localTrackName'))) {
    const endpoints = trackOccupancies.flatMap<BlockEndpoint>((occupancy) =>
      occupancy.startTime === occupancy.endTime
        ? [{ time: occupancy.startTime, type: 'instant', occupancy }]
        : [
            { time: occupancy.startTime, type: 'start', occupancy },
            { time: occupancy.endTime, type: 'end', occupancy },
          ]
    );
    endpoints.sort(
      (a, b) =>
        a.time - b.time ||
        ENDPOINT_RANK[a.type] - ENDPOINT_RANK[b.type] ||
        BLOCK_RANK[a.occupancy.blockType] - BLOCK_RANK[b.occupancy.blockType]
    );

    let linkingSource: RepeatedOccupancy | null = null;
    let openBlocks = 0;

    for (const { type, occupancy } of endpoints) {
      // A stop of no duration holds the whole occupancy in one instant, where the train both
      // reaches the track and leaves it.
      const isLinkingArrival =
        (type === 'end' || type === 'instant') &&
        occupancy.blockType === 'incoming' &&
        occupancy.isStop;
      const isLinkingDeparture =
        (type === 'start' || type === 'instant') &&
        occupancy.blockType === 'outgoing' &&
        occupancy.isStop;
      const isTrackFree = openBlocks === 0;

      if (isLinkingArrival) {
        linkingSource = occupancy;
      } else if (isLinkingDeparture && linkingSource && isTrackFree) {
        if (isLinkable(linkingSource, occupancy, hourlyPatternDuration)) {
          const offset = getOffsetInPattern(linkingSource.repeatOffset, hourlyPatternDuration);
          const linking = linkings.get(linkingSource.trainId);
          if (linking?.target === occupancy.trainId) linking.sourceOffsets.add(offset);
          else {
            linkings.set(linkingSource.trainId, {
              target: occupancy.trainId,
              sourceOffsets: new Set([offset]),
            });
          }
        }
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
