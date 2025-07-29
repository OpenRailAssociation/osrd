import { describe, it, expect } from 'vitest';

import type { OccurrenceId, TrainScheduleId } from 'reducers/osrdconf/types';

import makeDraggingState from '../makeDraggingState';

describe('makeDraggingState', () => {
  describe('train schedule', () => {
    const projectedTrains = [
      {
        name: 'GE LYD',
        departureTime: new Date('2025-07-25T11:19:04.820Z'),
        spaceTimeCurves: [
          {
            positions: [0, 2408, 8726],
            times: [0, 2000, 4000],
          },
        ],
        signalUpdates: [],
        id: 'trainschedule_8383' as TrainScheduleId,
        originPathItemLocation: {
          id: '2de0a9f4-d7fd-486c-8fa6-e23c85cc5ecb',
          deleted: false,
          uic: 1,
          secondary_code: 'BV',
          track_reference: null,
        },
        destinationPathItemLocation: {
          id: 'c95dd420-de77-4047-be7b-21770d973283',
          deleted: false,
          uic: 2,
          secondary_code: 'BV',
          track_reference: null,
        },
      },
    ];
    it('should return the currently hovered train schedule', () => {
      const hoveredItem = {
        layer: 'paths',
        element: {
          type: 'segment',
          pathId: 'trainschedule_8383',
          from: {
            x: 600.121422635069,
            y: 164.26262468678837,
          },
          to: {
            x: 601.0516031411173,
            y: 166.68650731525275,
          },
        },
      } as const;

      expect(makeDraggingState(hoveredItem, projectedTrains)).toEqual({
        draggedTrain: projectedTrains[0],
        initialDepartureTime: projectedTrains[0].departureTime,
      });
    });
    it('should handle train id no found', () => {
      const hoveredItem = {
        layer: 'paths',
        element: {
          type: 'segment',
          pathId: 'trainschedule_6666666',
          from: {
            x: 600.121422635069,
            y: 164.26262468678837,
          },
          to: {
            x: 601.0516031411173,
            y: 166.68650731525275,
          },
        },
      } as const;
      expect(makeDraggingState(hoveredItem, projectedTrains)).toEqual(null);
    });
    it('should handle invalid train id', () => {
      const hoveredItem = {
        layer: 'paths',
        element: {
          type: 'segment',
          pathId: 'invalid_train_id',
          from: {
            x: 600.121422635069,
            y: 164.26262468678837,
          },
          to: {
            x: 601.0516031411173,
            y: 166.68650731525275,
          },
        },
      } as const;
      expect(() => makeDraggingState(hoveredItem, projectedTrains)).toThrow(
        'hovered train id should be a train schedule id or an occurrence i'
      );
    });
  });
  describe('paced train', () => {
    describe('1 ADDED start time exception and 2 MODIFIED start time exceptions', () => {
      // we are dragging a normal occurrence, it should modify the paced train start time in projectPathTrainResults
      // (in SimulationResults where the state is held)
      // => we use the occurrence ID and the paced train start time as initialDepartureTime
      const projectedTrains = [
        // 1 train schedule
        {
          name: 'GE LYD',
          departureTime: new Date('2025-07-25T11:19:04.820Z'),
          spaceTimeCurves: [
            {
              positions: [0, 2408, 8726],
              times: [0, 2000, 4000],
            },
          ],
          signalUpdates: [],
          id: 'trainschedule_8383' as TrainScheduleId,
          originPathItemLocation: {
            id: '2de0a9f4-d7fd-486c-8fa6-e23c85cc5ecb',
            deleted: false,
            uic: 1,
            secondary_code: 'BV',
            track_reference: null,
          },
          destinationPathItemLocation: {
            id: 'c95dd420-de77-4047-be7b-21770d973283',
            deleted: false,
            uic: 2,
            secondary_code: 'BV',
            track_reference: null,
          },
        },
        // paced train
        {
          departureTime: new Date('2025-07-25T03:28:57.188Z'),
          spaceTimeCurves: [
            {
              positions: [0, 2408, 8726],
              times: [0, 2000, 4000],
            },
          ],
          signalUpdates: [],
          id: 'indexedoccurrence_2563_0' as OccurrenceId,
          name: 'a 1',
          isStartTimeException: false,
          pacedTrainDepartureTime: new Date('2025-07-25T03:54:30.922Z'),
        },
        {
          departureTime: new Date('2025-07-25T04:28:57.188Z'),
          spaceTimeCurves: [
            {
              positions: [0, 2408, 8726],
              times: [0, 2000, 4000],
            },
          ],
          signalUpdates: [],
          id: 'indexedoccurrence_2563_1' as OccurrenceId,
          name: 'a 3',
          isStartTimeException: false,
          pacedTrainDepartureTime: new Date('2025-07-25T03:54:30.922Z'),
        },
        {
          departureTime: new Date('2025-07-25T06:15:00.000Z'),
          spaceTimeCurves: [
            {
              positions: [0, 2408, 8726],
              times: [0, 2000, 4000],
            },
          ],
          signalUpdates: [],
          id: 'indexedoccurrence_2563_2' as OccurrenceId,
          name: 'a 5',
          isStartTimeException: true,
          pacedTrainDepartureTime: new Date('2025-07-25T03:54:30.922Z'),
        },
        {
          departureTime: new Date('2025-07-25T07:20:10.000Z'),
          spaceTimeCurves: [
            {
              positions: [0, 2408, 8726],
              times: [0, 2000, 4000],
            },
          ],
          signalUpdates: [],
          id: 'indexedoccurrence_2563_3' as OccurrenceId,
          name: 'a 7',
          isStartTimeException: true,
          pacedTrainDepartureTime: new Date('2025-07-25T03:54:30.922Z'),
        },
        {
          name: 'a/+',
          departureTime: new Date('2025-07-25T10:00:00.000Z'),
          spaceTimeCurves: [
            {
              positions: [0, 2408, 8726],
              times: [0, 2000, 4000],
            },
          ],
          signalUpdates: [],
          id: 'exception_2563_ed44851d-eed0-47e9-81cb-799e58e569d5' as OccurrenceId,
          isStartTimeException: true,
          pacedTrainDepartureTime: new Date('2025-07-25T03:54:30.922Z'),
        },
      ];
      it('should return the hovered occurrence and paced train startTime', () => {
        const hoveredItem = {
          layer: 'paths',
          element: {
            type: 'segment',
            pathId: 'indexedoccurrence_2563_1',
          },
        } as const;
        expect(makeDraggingState(hoveredItem, projectedTrains)).toEqual({
          draggedTrain: projectedTrains[2],
          initialDepartureTime: new Date('2025-07-25T03:54:30.922Z'),
        });
      });
      it('should return null when we try to drag a MODIFIED start time exception', () => {
        const hoveredItem = {
          layer: 'paths',
          element: {
            type: 'segment',
            pathId: 'indexedoccurrence_2563_3',
          },
        } as const;
        expect(makeDraggingState(hoveredItem, projectedTrains)).toEqual(null);
      });
      it('should return null when we try to drag an ADDED start time exception', () => {
        const hoveredItem = {
          layer: 'paths',
          element: {
            type: 'segment',
            pathId: 'exception_2563_ed44851d-eed0-47e9-81cb-799e58e569d5',
          },
        } as const;
        expect(makeDraggingState(hoveredItem, projectedTrains)).toEqual(null);
      });
    });
  });
});
