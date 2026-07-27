import { describe, it, expect } from 'vitest';

import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import computePossibleLinkings, { type LinkableOccupancy } from '../computePossibleLinkings';

const MINUTE = 60_000;
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

    expect(linkings).toEqual(
      new Map([[formatEditoastIdToTrainScheduleId(1), formatEditoastIdToTrainScheduleId(2)]])
    );
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

    expect(linkings).toEqual(
      new Map([[formatEditoastIdToTrainScheduleId(1), formatEditoastIdToTrainScheduleId(2)]])
    );
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

  it.each([undefined, null])(
    'should not link trains whose track is unknown (%s)',
    (localTrackName) => {
      const linkings = computePossibleLinkings([
        arriving({ localTrackName, editoastId: 1, startTime: 0, endTime: 10 * MINUTE }),
        departing({
          localTrackName,
          editoastId: 2,
          startTime: 30 * MINUTE,
          endTime: 40 * MINUTE,
        }),
      ]);

      expect(linkings).toEqual(new Map());
    }
  );

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

    expect(linkings).toEqual(
      new Map([[formatEditoastIdToTrainScheduleId(1), formatEditoastIdToTrainScheduleId(3)]])
    );
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

    expect(linkings).toEqual(
      new Map([
        [formatEditoastIdToTrainScheduleId(1), formatEditoastIdToTrainScheduleId(2)],
        [formatEditoastIdToTrainScheduleId(3), formatEditoastIdToTrainScheduleId(4)],
      ])
    );
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

    expect(linkings).toEqual(
      new Map([[formatEditoastIdToTrainScheduleId(2), formatEditoastIdToTrainScheduleId(3)]])
    );
  });
});
