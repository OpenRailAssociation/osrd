import { compact, last, omit } from 'lodash';
import { describe, beforeEach, it, expect } from 'vitest';

import { ArrivalTimeTypes, StdcmStopTypes } from 'applications/stdcm/types';
import type { Distribution, Infra, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { OperationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import { defaultCommonConf } from 'reducers/osrdconf/osrdConfCommon';
import commonConfBuilder from 'reducers/osrdconf/osrdConfCommon/__tests__/commonConfBuilder';
import type { StdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import type { OsrdConfState, PathStep } from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';
import { removeElementAtIndex } from 'utils/array';

function createStore(
  slice: OperationalStudiesConfSlice | StdcmConfSlice,
  initialStateExtra: Partial<OsrdConfState> = {}
) {
  return createStoreWithoutMiddleware({
    [slice.name]: { ...defaultCommonConf, ...initialStateExtra },
  });
}

const testSpeedLimitByTag = (
  slice: OperationalStudiesConfSlice | StdcmConfSlice,
  newTag: string | null
) => {
  const store = createStore(slice);
  store.dispatch(slice.actions.updateSpeedLimitByTag(newTag));
  return store.getState()[slice.name];
};

const testCommonConfReducers = (slice: OperationalStudiesConfSlice | StdcmConfSlice) => {
  const testDataBuilder = commonConfBuilder();
  let defaultStore: ReturnType<typeof createStore>;

  beforeEach(() => {
    defaultStore = createStore(slice);
  });

  it('should handle updateConstraintDistribution', () => {
    const newConstraintDistribution: Distribution = 'STANDARD';
    defaultStore.dispatch(slice.actions.updateConstraintDistribution(newConstraintDistribution));

    const state = defaultStore.getState()[slice.name];
    expect(state.constraintDistribution).toBe(newConstraintDistribution);
  });

  it('should handle updateName', () => {
    const newName = 'New Simulation Name';
    defaultStore.dispatch(slice.actions.updateName(newName));

    const state = defaultStore.getState()[slice.name];
    expect(state.name).toBe(newName);
  });

  it('should handle updateTrainCount', () => {
    const newTrainCount = 5;
    defaultStore.dispatch(slice.actions.updateTrainCount(newTrainCount));

    const state = defaultStore.getState()[slice.name];
    expect(state.trainCount).toBe(newTrainCount);
  });

  it('should handle update', () => {
    const newTrainDelta = 5;
    defaultStore.dispatch(slice.actions.updateTrainDelta(newTrainDelta));

    const state = defaultStore.getState()[slice.name];
    expect(state.trainDelta).toBe(newTrainDelta);
  });

  it('should handle updateTrainStep', () => {
    const newTrainStep = 5;
    defaultStore.dispatch(slice.actions.updateTrainStep(newTrainStep));

    const state = defaultStore.getState()[slice.name];
    expect(state.trainStep).toBe(newTrainStep);
  });

  it('should handle toggleUsingElectricalProfiles', () => {
    defaultStore.dispatch(slice.actions.toggleUsingElectricalProfiles());

    let state = defaultStore.getState()[slice.name];
    expect(state.usingElectricalProfiles).toBe(false);

    defaultStore.dispatch(slice.actions.toggleUsingElectricalProfiles());
    state = defaultStore.getState()[slice.name];
    expect(state.usingElectricalProfiles).toBe(true);
  });

  it('should handle updateLabels', () => {
    const newLabels = ['A', 'B'];
    defaultStore.dispatch(slice.actions.updateLabels(newLabels));
    const state = defaultStore.getState()[slice.name];
    expect(state.labels).toBe(newLabels);
  });

  it('should handle updateProjectID', () => {
    const newProjectID = 5;
    defaultStore.dispatch(slice.actions.updateProjectID(newProjectID));
    const state = defaultStore.getState()[slice.name];
    expect(state.projectID).toBe(newProjectID);
  });

  it('should handle updateStudyID', () => {
    const newStudyID = 5;
    defaultStore.dispatch(slice.actions.updateStudyID(newStudyID));
    const state = defaultStore.getState()[slice.name];
    expect(state.studyID).toBe(newStudyID);
  });

  it('should handle updateScenarioID', () => {
    const newScenarioID = 5;
    defaultStore.dispatch(slice.actions.updateScenarioID(newScenarioID));
    const state = defaultStore.getState()[slice.name];
    expect(state.scenarioID).toBe(newScenarioID);
  });

  it('should update infraID', () => {
    const newInfraID = 5;
    defaultStore.dispatch(slice.actions.updateInfraID(newInfraID));
    const state = defaultStore.getState()[slice.name];
    expect(state.infraID).toBe(newInfraID);
  });

  describe('should handle updateInfra', () => {
    it('should update infraLockStatus to true', () => {
      const newInfra = { id: 6, locked: false } as unknown as Infra;
      defaultStore.dispatch(slice.actions.updateInfra(newInfra));
      const state = defaultStore.getState()[slice.name];
      expect(state.infraIsLocked).toBe(newInfra.locked);
      expect(state.infraID).toBe(newInfra.id);
    });
    it('should update infraLockStatus to false', () => {
      const newInfra = { id: 6, locked: false } as unknown as Infra;
      defaultStore.dispatch(slice.actions.updateInfra(newInfra));
      const state = defaultStore.getState()[slice.name];
      expect(state.infraIsLocked).toBe(newInfra.locked);
      expect(state.infraID).toBe(newInfra.id);
    });
  });

  it('should handle updateTimetableID', () => {
    const newTimetableID = 1;
    defaultStore.dispatch(slice.actions.updateTimetableID(newTimetableID));
    const state = defaultStore.getState()[slice.name];
    expect(state.timetableID).toBe(newTimetableID);
  });

  it('should handle updateElectricalProfileSetId with number', () => {
    const newElectricalProfileSetId = 1;
    defaultStore.dispatch(slice.actions.updateElectricalProfileSetId(newElectricalProfileSetId));
    const state = defaultStore.getState()[slice.name];
    expect(state.electricalProfileSetId).toBe(newElectricalProfileSetId);
  });

  it('should handle updateElectricalProfileSetId with undefined', () => {
    const newElectricalProfileSetId = undefined;
    defaultStore.dispatch(slice.actions.updateElectricalProfileSetId(newElectricalProfileSetId));
    const state = defaultStore.getState()[slice.name];
    expect(state.electricalProfileSetId).toBe(undefined);
  });

  it('should handle updateRollingStockID', () => {
    const newRollingStockID = 1;
    defaultStore.dispatch(slice.actions.updateRollingStockID(newRollingStockID));
    const state = defaultStore.getState()[slice.name];
    expect(state.rollingStockID).toBe(newRollingStockID);
  });

  describe('should handle updateSpeedLimitByTag', () => {
    it('should update speedLimitByTag with a non-null value', () => {
      const newSpeedLimitByTag = 'test-tag';
      const state = testSpeedLimitByTag(slice, newSpeedLimitByTag);
      expect(state.speedLimitByTag).toBe(newSpeedLimitByTag);
    });

    it('should set speedLimitByTag to undefined if dispatched null value', () => {
      const newSpeedLimitByTag = null;
      const state = testSpeedLimitByTag(slice, newSpeedLimitByTag);
      expect(state.speedLimitByTag).toBe(undefined);
    });
  });

  it('should handle updateInitialSpeed', () => {
    const newInitialSpeed = 50;
    defaultStore.dispatch(slice.actions.updateInitialSpeed(newInitialSpeed));
    const state = defaultStore.getState()[slice.name];
    expect(state.initialSpeed).toBe(newInitialSpeed);
  });

  it('should handle updateViaStopTime', () => {
    const pathSteps = testDataBuilder.buildPathSteps();
    const via = pathSteps[1];
    const store = createStore(slice, {
      pathSteps,
    });

    store.dispatch(
      slice.actions.updateViaStopTime({
        via,
        duration: 'PT60S',
        stopType: StdcmStopTypes.SERVICE_STOP,
      })
    );
    const state = store.getState()[slice.name];
    expect(state.pathSteps[1]?.stopFor).toEqual('PT60S');
    expect(state.pathSteps[1]?.stopType).toEqual('serviceStop');
  });

  it('should handle updateFeatureInfoClick', () => {
    const newFeatureClick = testDataBuilder.buildFeatureInfoClick();
    defaultStore.dispatch(slice.actions.updateFeatureInfoClick(newFeatureClick));
    const state = defaultStore.getState()[slice.name];
    const feature = omit(newFeatureClick.feature, ['_vectorTileFeature']);
    const expected = { ...newFeatureClick, feature };
    expect(state.featureInfoClick).toStrictEqual(expected);
  });

  it('should handle updateGridMarginBefore', () => {
    const newGridMarginBefore = 5;
    defaultStore.dispatch(slice.actions.updateGridMarginBefore(newGridMarginBefore));
    const state = defaultStore.getState()[slice.name];
    expect(state.gridMarginBefore).toStrictEqual(newGridMarginBefore);
  });

  it('should handle updateGridMarginAfter', () => {
    const newGridMarginAfter = 5;
    defaultStore.dispatch(slice.actions.updateGridMarginAfter(newGridMarginAfter));
    const state = defaultStore.getState()[slice.name];
    expect(state.gridMarginAfter).toStrictEqual(newGridMarginAfter);
  });

  it('should handle updatePathSteps', () => {
    const pathSteps = testDataBuilder.buildPathSteps();
    defaultStore.dispatch(slice.actions.updatePathSteps({ pathSteps }));
    const state = defaultStore.getState()[slice.name];
    expect(state.pathSteps).toEqual(pathSteps);
  });

  it('should handle updateOrigin', () => {
    const newOrigin = {
      ...testDataBuilder.buildPathSteps()[0],
      arrivalType: ArrivalTimeTypes.PRECISE_TIME,
    };
    defaultStore.dispatch(slice.actions.updateOrigin(newOrigin));
    const state = defaultStore.getState()[slice.name];
    expect(state.pathSteps[0]).toEqual(newOrigin);
  });

  it('should handle updateDestination', () => {
    const lastPathStep = last(testDataBuilder.buildPathSteps());
    const newDestination = { ...lastPathStep!, arrivalType: ArrivalTimeTypes.ASAP };
    defaultStore.dispatch(slice.actions.updateDestination(newDestination));
    const state = defaultStore.getState()[slice.name];
    expect(last(state.pathSteps)).toEqual(newDestination);
  });

  it('should handle deleteItinerary', () => {
    const pathSteps = testDataBuilder.buildPathSteps();
    const store = createStore(slice, {
      pathSteps,
    });
    store.dispatch(slice.actions.deleteItinerary());
    const state = store.getState()[slice.name];
    expect(state.pathSteps).toEqual([null, null]);
  });

  it('should handle clearVias', () => {
    const pathSteps = testDataBuilder.buildPathSteps();
    const store = createStore(slice, {
      pathSteps,
    });
    store.dispatch(slice.actions.clearVias());
    const state = store.getState()[slice.name];
    expect(state.pathSteps).toEqual([pathSteps[0], last(pathSteps)]);
  });

  it('should handle deleteVia', () => {
    const pathSteps = testDataBuilder.buildPathSteps();
    const store = createStore(slice, {
      pathSteps,
    });
    store.dispatch(slice.actions.deleteVia(0));
    const state = store.getState()[slice.name];
    expect(state.pathSteps).toEqual(removeElementAtIndex(pathSteps, 1));
  });

  describe('should handle addVia', () => {
    const pathStepsData = testDataBuilder.buildPathSteps();
    const [brest, rennes, lemans, paris, strasbourg] = compact(pathStepsData);
    const pathProperties = testDataBuilder.buildPathProperties();
    // Those are not supposed to have the position on path, its calculated by the helper
    const [rennesNoPosition, lemansNoPosition, parisNoPosition] = [rennes, lemans, paris].map(
      (step) => omit(step, ['positionOnPath'])
    );

    it('should handle insertion for a route with no existing via and no origin', () => {
      const pathSteps = [null, strasbourg];
      const store = createStore(slice, {
        pathSteps,
      });

      store.dispatch(slice.actions.addVia({ newVia: paris, pathProperties }));
      const state = store.getState()[slice.name];
      expect(state.pathSteps).toStrictEqual([null, parisNoPosition, strasbourg]);
    });

    it('should handle insertion for a route with no existing via and no destination', () => {
      const pathSteps = [brest, null];
      const store = createStore(slice, {
        pathSteps,
      });

      store.dispatch(slice.actions.addVia({ newVia: rennes, pathProperties }));
      const state = store.getState()[slice.name];
      expect(state.pathSteps).toStrictEqual([brest, rennesNoPosition, null]);
    });

    it('should handle insertion for a route with no existing via', () => {
      const pathSteps = [brest, strasbourg];
      const store = createStore(slice, {
        pathSteps,
      });

      store.dispatch(slice.actions.addVia({ newVia: lemans, pathProperties }));
      const state = store.getState()[slice.name];
      expect(state.pathSteps).toStrictEqual([brest, lemansNoPosition, strasbourg]);
    });

    it('should correctly append a new via point when the existing via is closer to the origin', () => {
      const pathSteps = [brest, rennes, strasbourg];
      const store = createStore(slice, {
        pathSteps,
      });

      store.dispatch(slice.actions.addVia({ newVia: lemans, pathProperties }));
      const state = store.getState()[slice.name];
      expect(state.pathSteps).toStrictEqual([brest, rennes, lemansNoPosition, strasbourg]);
    });

    it('should insert a via between two existing ones based on distance from origin', () => {
      const pathSteps = [brest, rennes, paris, strasbourg];
      const store = createStore(slice, {
        pathSteps,
      });

      store.dispatch(slice.actions.addVia({ newVia: lemans, pathProperties }));
      const state = store.getState()[slice.name];
      expect(state.pathSteps).toStrictEqual([brest, rennes, lemansNoPosition, paris, strasbourg]);
    });

    it('should insert a via at the end of the route', () => {
      const pathSteps = [brest, rennes, lemans, strasbourg];
      const store = createStore(slice, {
        pathSteps,
      });

      store.dispatch(slice.actions.addVia({ newVia: paris, pathProperties }));
      const state = store.getState()[slice.name];
      expect(state.pathSteps).toStrictEqual([brest, rennes, lemans, parisNoPosition, strasbourg]);
    });
  });

  it('should handle moveVia', () => {
    const pathSteps = testDataBuilder.buildPathSteps();
    const [brest, rennes, lemans, paris, strasbourg] = pathSteps;

    const store = createStore(slice, { pathSteps: [brest, rennes, lemans, paris, strasbourg] });

    store.dispatch(slice.actions.moveVia(pathSteps, 0, 2));
    const state = store.getState()[slice.name];
    expect(state.pathSteps).toStrictEqual([brest, lemans, paris, rennes, strasbourg]);
  });

  describe('should handle upsertViaFromSuggestedOP', () => {
    // For this action, pathfinding has already been made so we know
    // all steps will have a positionOnPath
    const pathStepsData = testDataBuilder
      .buildPathSteps()
      .map((step, i) => step && { ...step, positionOnPath: i * 100 });

    const [brest, rennes, lemans, paris, strasbourg] = pathStepsData;

    it('should insert a new via if it comes from the suggested vias modal', () => {
      const pathSteps = [brest, rennes, paris, strasbourg];
      const store = createStore(slice, {
        pathSteps,
      });

      const newVia: SuggestedOP = {
        opId: 'lemans',
        track: '60ca8dda-6667-11e3-81ff-01f464e0362d',
        offsetOnTrack: 426.443,
        positionOnPath: 200,
        uic: 396002,
        coordinates: [47.99542250806296, 0.1918181738752042],
      };

      const insertedVia: PathStep = {
        id: 'id1', // the id generated by nextId()
        positionOnPath: 200,
        uic: 396002,
        coordinates: [47.99542250806296, 0.1918181738752042],
      };

      store.dispatch(slice.actions.upsertViaFromSuggestedOP(newVia));
      const state = store.getState()[slice.name];
      expect(state.pathSteps).toEqual([brest, rennes, insertedVia, paris, strasbourg]);
    });

    it('should update an existing via if it comes from the "times and step" table and has been added by selecting it on the map', () => {
      const pathSteps = [brest, rennes, lemans, paris, strasbourg];
      const store = createStore(slice, {
        pathSteps,
      });

      const newVia: SuggestedOP = {
        opId: 'lemans',
        track: '60ca8dda-6667-11e3-81ff-01f464e0362d',
        offsetOnTrack: 426.443,
        positionOnPath: 200,
        stopFor: 'PT5M',
        coordinates: [47.99542250806296, 0.1918181738752042],
      };

      const updatedVia: PathStep = {
        id: 'lemans',
        positionOnPath: 200,
        track: '60ca8dda-6667-11e3-81ff-01f464e0362d',
        offset: 426.443,
        stopFor: 'PT5M',
        coordinates: [47.99542250806296, 0.1918181738752042],
        arrival: newVia.arrival,
        locked: newVia.locked,
        deleted: newVia.deleted,
        name: newVia.name,
        ch: newVia.ch,
      };

      store.dispatch(slice.actions.upsertViaFromSuggestedOP(newVia));
      const state = store.getState()[slice.name];
      expect(state.pathSteps).toEqual([brest, rennes, updatedVia, paris, strasbourg]);
    });
  });

  it('should handle updateRollingStockComfort', () => {
    const newRollingStockComfort: TrainScheduleBase['comfort'] = 'AIR_CONDITIONING';
    defaultStore.dispatch(slice.actions.updateRollingStockComfort(newRollingStockComfort));
    const state = defaultStore.getState()[slice.name];
    expect(state.rollingStockComfort).toBe(newRollingStockComfort);
  });

  it('should handle updateStartTime', () => {
    const newStartTime = '2024-05-01T11:08:00.000+01:00';
    defaultStore.dispatch(slice.actions.updateStartTime(newStartTime));
    const state = defaultStore.getState()[slice.name];
    expect(state.startTime).toBe(newStartTime);
  });
};

export default testCommonConfReducers;
