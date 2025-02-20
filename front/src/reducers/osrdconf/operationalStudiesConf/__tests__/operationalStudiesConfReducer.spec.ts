import { describe, it, expect } from 'vitest';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';
import {
  operationalStudiesConfSlice,
  operationalStudiesInitialConf,
} from 'reducers/osrdconf/operationalStudiesConf';
import commonConfBuilder from 'reducers/osrdconf/osrdConfCommon/__tests__/commonConfBuilder';
import testCommonConfReducers from 'reducers/osrdconf/osrdConfCommon/__tests__/utils';
import type {
  OperationalStudiesConfState,
  PathStep,
  TrainScheduleId,
} from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';
import { Duration } from 'utils/duration';

import testTrainSettingsReducer from './trainSettingsReducer';

const createStore = (extraInitialState?: Partial<OperationalStudiesConfState>) =>
  createStoreWithoutMiddleware({
    [operationalStudiesConfSlice.name]: {
      ...operationalStudiesInitialConf,
      ...extraInitialState,
    },
  });

describe('simulationConfReducer', () => {
  it('should return initial state', () => {
    const store = createStore();
    const state = store.getState()[operationalStudiesConfSlice.name];
    expect(state).toEqual(operationalStudiesInitialConf);
  });

  it('selectTrainToEdit', () => {
    // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
    const trainSchedule: TrainScheduleWithDetails = {
      id: 'trainschedule-1' as TrainScheduleId,
      trainName: 'train1',
      constraint_distribution: 'MARECO',
      rollingStock: { id: 1, name: 'rollingStock1' } as LightRollingStockWithLiveries,
      path: [
        { id: 'id1', uic: 123 },
        { id: 'id2', uic: 234 },
      ],
      margins: { boundaries: ['id2'], values: ['10%', '0%'] },
      startTime: new Date('2021-01-01T00:00:00Z'),
      arrivalTime: null,
      duration: new Duration({ milliseconds: 1000 }),
      stopsCount: 2,
      pathLength: '100',
      mechanicalEnergyConsumed: 100,
      speedLimitTag: 'MA100',
      labels: ['label1'],
      isValid: true,
      options: { use_electrical_profiles: false },
    };

    const store = createStore();
    store.dispatch(operationalStudiesConfSlice.actions.selectTrainToEdit(trainSchedule));

    const state = store.getState()[operationalStudiesConfSlice.name];
    expect(state).toEqual({
      ...operationalStudiesInitialConf,
      usingElectricalProfiles: false,
      labels: ['label1'],
      rollingStockID: 1,
      speedLimitByTag: 'MA100',
      name: 'train1',
      pathSteps: [
        {
          id: 'id1',
          uic: 123,
          name: '123',
          theoreticalMargin: '10%',
          arrival: null,
          stopFor: null,
          locked: undefined,
          receptionSignal: undefined,
        },
        {
          id: 'id2',
          uic: 234,
          name: '234',
          theoreticalMargin: undefined,
          arrival: null,
          stopFor: null,
          locked: undefined,
          receptionSignal: undefined,
        },
      ],
      startTime: new Date('2021-01-01T00:00:00+00:00'),
    });
  });

  describe('should handle upsertViaFromSuggestedOP', () => {
    const testDataBuilder = commonConfBuilder();

    // For this action, pathfinding has already been made so we know
    // all steps will have a positionOnPath
    const pathStepsData = testDataBuilder
      .buildPathSteps()
      .map((step, i) => step && { ...step, positionOnPath: i * 100 });

    const [brest, rennes, lemans, paris, strasbourg] = pathStepsData;

    it('should insert a new via if it comes from the suggested vias modal', () => {
      const pathSteps = [brest, rennes, paris, strasbourg];
      const store = createStore({ pathSteps });

      const newVia: SuggestedOP = {
        opId: 'lemans',
        track: '60ca8dda-6667-11e3-81ff-01f464e0362d',
        offsetOnTrack: 426.443,
        positionOnPath: 200,
        uic: 396002,
        coordinates: [47.99542250806296, 0.1918181738752042],
      };

      const insertedVia: PathStep = {
        id: 'id1',
        positionOnPath: 200,
        uic: 396002,
        coordinates: [47.99542250806296, 0.1918181738752042],
      };

      store.dispatch(operationalStudiesConfSlice.actions.upsertViaFromSuggestedOP(newVia));
      const state = store.getState()[operationalStudiesConfSlice.name];
      expect(state.pathSteps).toEqual([
        brest,
        rennes,
        { ...insertedVia, id: state.pathSteps[2]?.id },
        paris,
        strasbourg,
      ]);
    });

    it('should update an existing via if it comes from the "times and step" table and has been added by selecting it on the map', () => {
      const pathSteps = [brest, rennes, lemans, paris, strasbourg];
      const store = createStore({ pathSteps });

      const newVia: SuggestedOP = {
        pathStepId: 'lemans',
        track: '60ca8dda-6667-11e3-81ff-01f464e0362d',
        offsetOnTrack: 426.443,
        positionOnPath: 200,
        stopFor: Duration.parse('PT5M'),
        coordinates: [47.99542250806296, 0.1918181738752042],
      };

      const updatedVia: PathStep = {
        id: 'lemans',
        positionOnPath: 200,
        track: '60ca8dda-6667-11e3-81ff-01f464e0362d',
        offset: 426.443,
        stopFor: Duration.parse('PT5M'),
        coordinates: [47.99542250806296, 0.1918181738752042],
        locked: newVia.locked,
        deleted: newVia.deleted,
        name: newVia.name,
      };

      store.dispatch(operationalStudiesConfSlice.actions.upsertViaFromSuggestedOP(newVia));
      const state = store.getState()[operationalStudiesConfSlice.name];
      expect(state.pathSteps).toEqual([brest, rennes, updatedVia, paris, strasbourg]);
    });
  });

  testCommonConfReducers(operationalStudiesConfSlice);
  testTrainSettingsReducer();
});
