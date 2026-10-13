import { describe, it, expect } from 'vitest';

import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import computePossibleLinkings, {
  type LinkableOccupancy,
  type PossibleLinkings,
} from '../computePossibleLinkings';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const TRACK_1 = 'V1';
const TRACK_2 = 'V2';

type OccupancyFixture = Omit<
  LinkableOccupancy,
  'trainId' | 'localTrackName' | 'blockType' | 'isStop' | 'active'
> & {
  editoastId: number;
  /** Required, though it may be nil, so that every fixture states the occupied track. */
  localTrackName: LinkableOccupancy['localTrackName'];
  isStop?: boolean;
  active?: boolean;
};

const buildOccupancy = ({
  editoastId,
  ...occupancy
}: OccupancyFixture & Pick<LinkableOccupancy, 'blockType'>): LinkableOccupancy => ({
  trainId: formatEditoastIdToTrainScheduleId(editoastId),
  isStop: true,
  active: true,
  ...occupancy,
});

/** An occupancy of a train ending its path on the track. */
const arriving = (occupancy: OccupancyFixture) =>
  buildOccupancy({ ...occupancy, blockType: 'incoming' });

/** An occupancy of a train starting its path on the track. */
const departing = (occupancy: OccupancyFixture) =>
  buildOccupancy({ ...occupancy, blockType: 'outgoing' });

/** An occupancy of a train whose path neither starts nor ends on the track. */
const via = (occupancy: OccupancyFixture) => buildOccupancy({ ...occupancy, blockType: 'via' });

/**
 * The linkings expected, by editoast IDs of the source and the target, with the offsets of the
 * source they are possible on: only 0 in a calendar timetable.
 */
const expectedLinkings = (
  ...linkings: { source: number; target: number; offsets?: number[] }[]
): PossibleLinkings =>
  new Map(
    linkings.map(({ source, target, offsets = [0] }) => [
      formatEditoastIdToTrainScheduleId(source),
      { target: formatEditoastIdToTrainScheduleId(target), sourceOffsets: new Set(offsets) },
    ])
  );

describe('computePossibleLinkings', () => {
  it('should link a train ending its path to the next one starting from a stop on the same track', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }));
  });

  it('should link two trains occupying the track back to back', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 10 * MINUTE,
        endTime: 20 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }));
  });

  it('should link a train whose stop lasts no time to the next one', () => {
    const linkings = computePossibleLinkings([
      arriving({
        localTrackName: TRACK_1,
        editoastId: 1,
        startTime: 10 * MINUTE,
        endTime: 10 * MINUTE,
      }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }));
  });

  it('should link a train to the next one whose stop lasts no time', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 30 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }));
  });

  it('should link two trains handing the track over at the same instant', () => {
    const linkings = computePossibleLinkings([
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 10 * MINUTE,
        endTime: 10 * MINUTE,
      }),
      arriving({
        localTrackName: TRACK_1,
        editoastId: 1,
        startTime: 10 * MINUTE,
        endTime: 10 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }));
  });

  it('should return no linking when there is no occupancy', () => {
    expect(computePossibleLinkings([])).toEqual(new Map());
  });

  it('should not link trains occupying different tracks', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      departing({
        localTrackName: TRACK_2,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it.each([undefined, null])('should link trains whose track is unknown (%s)', (localTrackName) => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      departing({
        localTrackName,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }));
  });

  it('should not link a train that does not end its path on the track', () => {
    const linkings = computePossibleLinkings([
      via({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it('should not link a train that does not start its path on the track', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      via({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it('should not link a train that does not stop at the end of its path', () => {
    const linkings = computePossibleLinkings([
      arriving({
        localTrackName: TRACK_1,
        editoastId: 1,
        startTime: 0,
        endTime: 10 * MINUTE,
        isStop: false,
      }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it('should not link a train that does not start its path from a stop', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
        isStop: false,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it('should not link two trains whose occupancies overlap', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 40 * MINUTE }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 60 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it('should not link two trains when another one occupies the track in between', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      via({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 15 * MINUTE,
        endTime: 20 * MINUTE,
      }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 3,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it('should not link two trains when another one covers the whole linking', () => {
    const linkings = computePossibleLinkings([
      via({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 60 * MINUTE }),
      arriving({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 5 * MINUTE,
        endTime: 10 * MINUTE,
      }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 3,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it('should not link two trains when another one crosses the track without stopping', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      via({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 15 * MINUTE,
        endTime: 15 * MINUTE,
        isStop: false,
      }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 3,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it('should not link two trains when another one crosses the track at the handover instant', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      via({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 10 * MINUTE,
        endTime: 10 * MINUTE,
        isStop: false,
      }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 3,
        startTime: 10 * MINUTE,
        endTime: 20 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(new Map());
  });

  it.each(['source', 'target'] as const)(
    'should not link the %s occurrence when it is disabled',
    (disabledSide) => {
      const linkings = computePossibleLinkings([
        arriving({
          localTrackName: TRACK_1,
          editoastId: 1,
          startTime: 0,
          endTime: 10 * MINUTE,
          active: disabledSide !== 'source',
        }),
        departing({
          localTrackName: TRACK_1,
          editoastId: 2,
          startTime: 30 * MINUTE,
          endTime: 40 * MINUTE,
          active: disabledSide !== 'target',
        }),
      ]);

      expect(linkings).toEqual(new Map());
    }
  );

  it('should ignore disabled occurrences when checking the track in between', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      via({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 15 * MINUTE,
        endTime: 20 * MINUTE,
        active: false,
      }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 3,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(expectedLinkings({ source: 1, target: 3 }));
  });

  it('should link the trains of each track independently', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
      arriving({
        localTrackName: TRACK_2,
        editoastId: 3,
        startTime: 5 * MINUTE,
        endTime: 15 * MINUTE,
      }),
      departing({
        localTrackName: TRACK_2,
        editoastId: 4,
        startTime: 20 * MINUTE,
        endTime: 50 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }, { source: 3, target: 4 }));
  });

  it('should not link two trains when another linkable occupancy stands in between', () => {
    const linkings = computePossibleLinkings([
      arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
      arriving({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 15 * MINUTE,
        endTime: 25 * MINUTE,
      }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 3,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      }),
      departing({
        localTrackName: TRACK_1,
        editoastId: 4,
        startTime: 45 * MINUTE,
        endTime: 55 * MINUTE,
      }),
    ]);

    expect(linkings).toEqual(expectedLinkings({ source: 2, target: 3 }));
  });

  describe('in an hourly pattern', () => {
    const patternDuration = 2 * HOUR;

    const paced = (occupancy: LinkableOccupancy, timeWindow = HOUR) => ({
      ...occupancy,
      timeWindow,
    });

    const arrival = paced(
      arriving({
        localTrackName: TRACK_1,
        editoastId: 1,
        startTime: 5 * MINUTE,
        endTime: 15 * MINUTE,
      })
    );
    const departure = paced(
      departing({
        localTrackName: TRACK_1,
        editoastId: 2,
        startTime: 30 * MINUTE,
        endTime: 40 * MINUTE,
      })
    );
    const crossing = paced(
      via({
        localTrackName: TRACK_1,
        editoastId: 3,
        startTime: HOUR + 20 * MINUTE,
        endTime: HOUR + 24 * MINUTE,
      }),
      2 * HOUR
    );

    it('should give the offsets of every repetition a linking is possible on', () => {
      const linkings = computePossibleLinkings([arrival, departure], patternDuration);

      expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2, offsets: [0, HOUR] }));
    });

    it('should not give the repetitions where another train breaks the linking', () => {
      const linkings = computePossibleLinkings([arrival, departure, crossing], patternDuration);

      expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }));
    });

    it('should not link two trains whose services last different times', () => {
      const linkings = computePossibleLinkings(
        [arrival, paced(departure, 2 * HOUR)],
        patternDuration
      );

      expect(linkings).toEqual(new Map());
    });

    it('should link unique trains once', () => {
      const linkings = computePossibleLinkings(
        [
          arriving({ localTrackName: TRACK_1, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
          departing({
            localTrackName: TRACK_1,
            editoastId: 2,
            startTime: 30 * MINUTE,
            endTime: 40 * MINUTE,
          }),
        ],
        patternDuration
      );

      expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }));
    });

    it('should link a train to the one departing on the next repetition', () => {
      const lateArrival = paced(
        arriving({
          localTrackName: TRACK_1,
          editoastId: 1,
          startTime: 45 * MINUTE,
          endTime: 55 * MINUTE,
        })
      );
      const earlyDeparture = paced(
        departing({
          localTrackName: TRACK_1,
          editoastId: 2,
          startTime: 5 * MINUTE,
          endTime: 12 * MINUTE,
        })
      );

      const linkings = computePossibleLinkings([lateArrival, earlyDeparture], patternDuration);

      // The second one goes past the end of the pattern, to the first departure of the next one.
      expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2, offsets: [0, HOUR] }));
    });

    it('should break a linking with a train of the previous pattern still occupying the track', () => {
      // Returned by editoast during the second pattern, it also crosses the track at 0:20.
      const overlapping = paced(
        via({
          localTrackName: TRACK_1,
          editoastId: 3,
          startTime: 2 * HOUR + 20 * MINUTE,
          endTime: 2 * HOUR + 24 * MINUTE,
        }),
        2 * HOUR
      );

      const linkings = computePossibleLinkings([arrival, departure, overlapping], patternDuration);

      expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2, offsets: [HOUR] }));
    });

    it('should give the offsets within the pattern of a train occupying the track after it', () => {
      const laterArrival = paced(
        arriving({
          localTrackName: TRACK_1,
          editoastId: 1,
          startTime: 3 * HOUR + 5 * MINUTE,
          endTime: 3 * HOUR + 15 * MINUTE,
        })
      );

      const linkings = computePossibleLinkings(
        [laterArrival, departure, crossing],
        patternDuration
      );

      // Only its repetition arriving at 0:15 can be linked, which stands 3h before the block
      // editoast returned: an odd number of hours, hence the second hour of the pattern.
      expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2, offsets: [HOUR] }));
    });

    it('should link trains of different services out of an hourly pattern', () => {
      const linkings = computePossibleLinkings([arrival, paced(departure, 2 * HOUR)]);

      expect(linkings).toEqual(expectedLinkings({ source: 1, target: 2 }));
    });
  });
});
