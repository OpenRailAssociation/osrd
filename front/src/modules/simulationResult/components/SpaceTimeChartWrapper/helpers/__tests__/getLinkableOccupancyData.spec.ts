import { describe, it, expect } from 'vitest';

import type { PacedTrainException, PathItem } from 'common/api/osrdEditoastApi';
import type { TrainSpaceTimeData } from 'modules/simulationResult/types';

import getLinkableOccupancyData from '../getLinkableOccupancyData';

const pathItem = (id: string): PathItem => ({
  id,
  location: {
    type: 'operational_point_part_reference',
    operational_point: { type: 'uic', uic: 1 },
  },
});

const TRAIN: Pick<
  TrainSpaceTimeData,
  'originPathItem' | 'destinationPathItem' | 'schedule' | 'initialSpeed'
> = {
  originPathItem: pathItem('origin'),
  destinationPathItem: pathItem('destination'),
  schedule: [{ at: 'destination', stop_for: 'PT600S' }],
  initialSpeed: 10,
};

const exception = (changeGroups: Partial<PacedTrainException>): PacedTrainException => ({
  key: 'exception-key',
  ...changeGroups,
});

describe('getLinkableOccupancyData', () => {
  it('should mark an occupancy on the first path item as an outgoing block', () => {
    const { blockType } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'origin' },
      TRAIN
    );

    expect(blockType).toBe('outgoing');
  });

  it('should mark an occupancy on the last path item as an incoming block', () => {
    const { blockType } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'destination' },
      TRAIN
    );

    expect(blockType).toBe('incoming');
  });

  it('should mark an occupancy on any other path item as a via block', () => {
    const { blockType } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'intermediate-stop' },
      TRAIN
    );

    expect(blockType).toBe('via');
  });

  it('should mark an occupancy between two path items as a via block', () => {
    const { blockType } = getLinkableOccupancyData(
      {
        type: 'between_path_items',
        previous_path_item_id: 'origin',
        following_path_item_id: 'destination',
      },
      TRAIN
    );

    expect(blockType).toBe('via');
  });

  it('should locate an occupancy along the path of its own exception', () => {
    const pathException = exception({
      path_and_schedule: {
        path: [pathItem('other-origin'), pathItem('other-destination')],
        schedule: [],
        margins: { boundaries: [], values: [] },
        power_restrictions: [],
      },
    });

    expect(
      getLinkableOccupancyData(
        { type: 'exact_path_item', path_item_id: 'other-destination' },
        TRAIN,
        pathException
      ).blockType
    ).toBe('incoming');
    expect(
      getLinkableOccupancyData(
        { type: 'exact_path_item', path_item_id: 'destination' },
        TRAIN,
        pathException
      ).blockType
    ).toBe('via');
  });

  it('should mark an occupancy whose schedule holds a stop as a stop', () => {
    const { isStop } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'destination' },
      TRAIN
    );

    expect(isStop).toBe(true);
  });

  it('should mark a stop of no duration as a stop', () => {
    const { isStop } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'destination' },
      { ...TRAIN, schedule: [{ at: 'destination', stop_for: 'PT0S' }] }
    );

    expect(isStop).toBe(true);
  });

  it('should not mark an arrival the train runs through as a stop', () => {
    const { isStop } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'destination' },
      { ...TRAIN, schedule: [] }
    );

    expect(isStop).toBe(false);
  });

  it('should mark a departure at a null initial speed as a stop, with no scheduled stop', () => {
    const { isStop } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'origin' },
      { ...TRAIN, initialSpeed: 0 }
    );

    expect(isStop).toBe(true);
  });

  it('should not mark a departure at speed without a stop as a stop', () => {
    const { isStop } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'origin' },
      TRAIN
    );

    expect(isStop).toBe(false);
  });

  it('should mark a departure at speed as a stop when its schedule holds one', () => {
    const { isStop } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'origin' },
      { ...TRAIN, schedule: [{ at: 'origin', stop_for: 'PT10S' }] }
    );

    expect(isStop).toBe(true);
  });

  it('should mark a departure as a stop when an exception nullifies the initial speed', () => {
    const { isStop } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'origin' },
      TRAIN,
      exception({ initial_speed: { value: 0 } })
    );

    expect(isStop).toBe(true);
  });

  it('should read the stops of the schedule of its own exception', () => {
    const scheduleException = exception({
      path_and_schedule: {
        path: [pathItem('origin'), pathItem('destination')],
        schedule: [{ at: 'destination', stop_for: 'PT60S' }],
        margins: { boundaries: [], values: [] },
        power_restrictions: [],
      },
    });

    expect(
      getLinkableOccupancyData(
        { type: 'exact_path_item', path_item_id: 'destination' },
        { ...TRAIN, schedule: [] },
        scheduleException
      ).isStop
    ).toBe(true);
  });

  it('should mark an occurrence disabled by its exception as inactive', () => {
    const { active } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'origin' },
      TRAIN,
      exception({ disabled: true })
    );

    expect(active).toBe(false);
  });

  it('should mark an occurrence without exception as active', () => {
    const { active } = getLinkableOccupancyData(
      { type: 'exact_path_item', path_item_id: 'origin' },
      TRAIN
    );

    expect(active).toBe(true);
  });
});
