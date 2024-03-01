import { omit } from 'lodash';

import type { PointOnMap } from 'applications/operationalStudies/consts';
import type { Allowance, Infra } from 'common/api/osrdEditoastApi';
import type { OsrdConfState } from 'reducers/osrdconf/consts';
import type { OperationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import { defaultCommonConf } from 'reducers/osrdconf/osrdConfCommon';
import commonConfBuilder from 'reducers/osrdconf/osrdConfCommon/__tests__/commonConfBuilder';
import type { StdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import { createStoreWithoutMiddleware } from 'store';

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

  it('should handle updateAllowances', () => {
    const newAllowances: Allowance[] = [
      testDataBuilder.buildEngineeringAllowance(),
      testDataBuilder.buildStandardAllowance(),
    ];
    defaultStore.dispatch(slice.actions.updateAllowances(newAllowances));

    const state = defaultStore.getState()[slice.name];
    expect(state.allowances).toBe(newAllowances);
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

  it('should handle updatePathfindingID', () => {
    const newPathfindingID = 1;
    defaultStore.dispatch(slice.actions.updatePathfindingID(newPathfindingID));
    const state = defaultStore.getState()[slice.name];
    expect(state.pathfindingID).toBe(newPathfindingID);
    expect(state.powerRestrictionRanges).toStrictEqual([]);
  });

  it('should handle updateTimetableID', () => {
    const newTimetableID = 1;
    defaultStore.dispatch(slice.actions.updateTimetableID(newTimetableID));
    const state = defaultStore.getState()[slice.name];
    expect(state.timetableID).toBe(newTimetableID);
  });

  it('should handle updateRollingStockID', () => {
    const newRollingStockID = 1;
    defaultStore.dispatch(slice.actions.updateRollingStockID(newRollingStockID));
    const state = defaultStore.getState()[slice.name];
    expect(state.rollingStockID).toBe(newRollingStockID);
  });

  it('should handle updateRollingStockComfort', () => {
    const newRollingStockComfort = 'AC';
    defaultStore.dispatch(slice.actions.updateRollingStockComfort(newRollingStockComfort));
    const state = defaultStore.getState()[slice.name];
    expect(state.rollingStockComfort).toBe(newRollingStockComfort);
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

  it('should handle updateOrigin', () => {
    const newOrigin = testDataBuilder.buildPointOnMap();
    defaultStore.dispatch(slice.actions.updateOrigin(newOrigin));
    const state = defaultStore.getState()[slice.name];
    expect(state.origin).toBe(newOrigin);
  });

  it('should handle updateInitialSpeed', () => {
    const newInitialSpeed = 50;
    defaultStore.dispatch(slice.actions.updateInitialSpeed(newInitialSpeed));
    const state = defaultStore.getState()[slice.name];
    expect(state.initialSpeed).toBe(newInitialSpeed);
  });

  it('should handle updateDepartureTime', () => {
    const newDepartureTime = '09:00:00';
    defaultStore.dispatch(slice.actions.updateDepartureTime(newDepartureTime));
    const state = defaultStore.getState()[slice.name];
    expect(state.departureTime).toBe(newDepartureTime);
  });

  describe('should handle updateOriginTime', () => {
    it('should update only itself if not linked', () => {
      const store = createStore(slice, {
        originLinkedBounds: false,
        originUpperBoundTime: '15:30:00',
        originTime: '11:00:00',
      });

      store.dispatch(slice.actions.updateOriginTime('08:00:00'));

      const state = store.getState()[slice.name];
      expect(state.originTime).toBe('08:00:00');
      expect(state.originUpperBoundTime).toBe('15:30:00');
    });

    it('should update originUpperBoundTime if linked, and keep the difference between the two', () => {
      const store = createStore(slice, {
        originLinkedBounds: true,
        originUpperBoundTime: '15:30:00',
        originTime: '11:00:00',
      });

      store.dispatch(slice.actions.updateOriginTime('08:00:00'));

      const state = store.getState()[slice.name];
      expect(state.originTime).toBe('08:00:00');
      expect(state.originUpperBoundTime).toBe('12:30:00');
    });

    it('should use the default difference when originTime is not defined', () => {
      const store = createStore(slice, {
        originLinkedBounds: true,
        originUpperBoundTime: '15:30:00',
        originTime: undefined,
      });

      store.dispatch(slice.actions.updateOriginTime('08:00:00'));

      const state = store.getState()[slice.name];
      expect(state.originTime).toBe('08:00:00');
      expect(state.originUpperBoundTime).toBe('10:00:00');
    });

    it('should use the default difference when originUpperBoundTime is not defined', () => {
      const store = createStore(slice, {
        originLinkedBounds: true,
        originUpperBoundTime: undefined,
        originTime: '10:00:00',
      });

      store.dispatch(slice.actions.updateOriginTime('08:00:00'));

      const state = store.getState()[slice.name];
      expect(state.originTime).toBe('08:00:00');
      expect(state.originUpperBoundTime).toBe('10:00:00');
    });
  });

  describe('should handle updateOriginUpperBoundTime', () => {
    it('should update only itself if not linked', () => {
      const store = createStore(slice, {
        originLinkedBounds: false,
        originTime: '11:00:00',
        originUpperBoundTime: '15:30:00',
      });

      store.dispatch(slice.actions.updateOriginUpperBoundTime('20:00:00'));

      const state = store.getState()[slice.name];
      expect(state.originTime).toBe('11:00:00');
      expect(state.originUpperBoundTime).toBe('20:00:00');
    });

    it('should update originTime if linked, keeping the current difference between the two', () => {
      const store = createStore(slice, {
        originLinkedBounds: true,
        originTime: '11:00:00',
        originUpperBoundTime: '14:00:00',
      });

      store.dispatch(slice.actions.updateOriginUpperBoundTime('20:00:00'));

      const state = store.getState()[slice.name];
      expect(state.originTime).toBe('17:00:00');
      expect(state.originUpperBoundTime).toBe('20:00:00');
    });

    it('should use default difference if originTime not defined', () => {
      const store = createStore(slice, {
        originLinkedBounds: true,
        originTime: undefined,
        originUpperBoundTime: '14:00:00',
      });

      store.dispatch(slice.actions.updateOriginUpperBoundTime('20:00:00'));

      const state = store.getState()[slice.name];
      expect(state.originTime).toBe('18:00:00');
      expect(state.originUpperBoundTime).toBe('20:00:00');
    });

    it('should use default difference if originUpperBoundTime not defined', () => {
      const store = createStore(slice, {
        originLinkedBounds: true,
        originUpperBoundTime: undefined,
      });

      store.dispatch(slice.actions.updateOriginUpperBoundTime('20:00:00'));

      const state = store.getState()[slice.name];
      expect(state.originTime).toBe('18:00:00');
      expect(state.originUpperBoundTime).toBe('20:00:00');
    });
  });

  describe('should handle toggleOriginLinkedBounds', () => {
    it('set to false if true', () => {
      const store = createStore(slice, { originLinkedBounds: true });
      store.dispatch(slice.actions.toggleOriginLinkedBounds());
      const state = store.getState()[slice.name];
      expect(state.originLinkedBounds).toBe(false);
    });

    it('set to true if false', () => {
      const store = createStore(slice, { originLinkedBounds: false });

      store.dispatch(slice.actions.toggleOriginLinkedBounds());
      const state = store.getState()[slice.name];
      expect(state.originLinkedBounds).toBe(true);
    });
  });

  it('should handle updateOriginDate', () => {
    const newOriginDate = '13/12/2023';
    defaultStore.dispatch(slice.actions.updateOriginDate(newOriginDate));
    const state = defaultStore.getState()[slice.name];
    expect(state.originDate).toBe(newOriginDate);
  });

  it('should handle updateOriginUpperBoundDate', () => {
    const newOriginUpperBoundDate = '13/12/2023';
    defaultStore.dispatch(slice.actions.updateOriginUpperBoundDate(newOriginUpperBoundDate));
    const state = defaultStore.getState()[slice.name];
    expect(state.originUpperBoundDate).toBe(newOriginUpperBoundDate);
  });

  it('should handle replaceVias', () => {
    const newVias: PointOnMap[] = [testDataBuilder.buildPointOnMap()];
    defaultStore.dispatch(slice.actions.replaceVias(newVias));
    const state = defaultStore.getState()[slice.name];
    expect(state.vias).toBe(newVias);
  });

  describe('should handle addVias', () => {
    const brest = testDataBuilder.buildPointOnMap({
      id: 'brest',
      coordinates: [48.390394, -4.486076],
    });
    const rennes = testDataBuilder.buildPointOnMap({
      id: 'rennes',
      coordinates: [48.117266, -1.6777926],
    });
    const mans = testDataBuilder.buildPointOnMap({
      id: 'mans',
      coordinates: [48.00611, 0.199556],
    });
    const paris = testDataBuilder.buildPointOnMap({
      id: 'paris',
      coordinates: [48.8566, 2.3522],
    });
    const strasbourg = testDataBuilder.buildPointOnMap({
      id: 'paris',
      coordinates: [7.750713, 48.583148],
    });

    it('should handle insertion for a route with no existing via', () => {
      const store = createStore(slice, {
        origin: brest,
        destination: strasbourg,
        vias: [],
      });

      store.dispatch(slice.actions.addVias(mans));
      const state = store.getState()[slice.name];
      expect(state.vias).toStrictEqual([mans]);
    });

    it('should correctly append a new via point when the existing via is closer to the origin', () => {
      const store = createStore(slice, {
        origin: brest,
        destination: strasbourg,
        vias: [mans],
      });

      store.dispatch(slice.actions.addVias(rennes));
      const state = store.getState()[slice.name];
      expect(state.vias).toStrictEqual([rennes, mans]);
    });

    it('should insert a via between two existing ones based on distance from origin', () => {
      const store = createStore(slice, {
        origin: brest,
        destination: strasbourg,
        vias: [rennes, paris],
      });

      store.dispatch(slice.actions.addVias(mans));
      const state = store.getState()[slice.name];
      expect(state.vias).toStrictEqual([rennes, mans, paris]);
    });

    it('should insert a via at the end of the route', () => {
      const store = createStore(slice, {
        origin: brest,
        destination: strasbourg,
        vias: [rennes, mans],
      });

      store.dispatch(slice.actions.addVias(paris));
      const state = store.getState()[slice.name];
      expect(state.vias).toStrictEqual([rennes, mans, paris]);
    });
  });

  it('should handle updateViaStopTime', () => {
    const via1 = testDataBuilder.buildPointOnMap({ id: 'via-1' });
    const via2 = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    const vias = [via1, via2];
    const store = createStore(slice, { vias });

    store.dispatch(slice.actions.updateViaStopTime(vias, 0, 5));
    const state = store.getState()[slice.name];
    expect(state.vias).toStrictEqual([
      { id: 'via-1', name: 'point', duration: 5 },
      { id: 'via-2', name: 'point' },
    ] as PointOnMap[]);
  });

  it('should handle permuteVias', () => {
    const via1 = testDataBuilder.buildPointOnMap({ id: 'via-1' });
    const via2 = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    const vias = [via1, via2];
    const store = createStore(slice, { vias });

    store.dispatch(slice.actions.permuteVias(vias, 0, 1));
    const state = store.getState()[slice.name];
    expect(state.vias).toStrictEqual([
      { id: 'via-2', name: 'point' },
      { id: 'via-1', name: 'point' },
    ] as PointOnMap[]);
  });

  it('should handle updateSuggeredVias', () => {
    const via1 = testDataBuilder.buildPointOnMap({ id: 'via-1' });
    const via2 = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    const vias = [via1, via2];
    defaultStore.dispatch(slice.actions.updateSuggeredVias(vias));
    const state = defaultStore.getState()[slice.name];
    expect(state.suggeredVias).toStrictEqual(vias);
  });

  it('should handle clearVias', () => {
    const via1 = testDataBuilder.buildPointOnMap({ id: 'via-1' });
    const via2 = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    const vias = [via1, via2];
    const store = createStore(slice, { vias });
    store.dispatch(slice.actions.clearVias());
    const state = store.getState()[slice.name];
    expect(state.vias).toStrictEqual([]);
  });

  it('should handle deleteVias', () => {
    const via1 = testDataBuilder.buildPointOnMap({ id: 'via-1' });
    const via2 = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    const vias = [via1, via2];
    const store = createStore(slice, { vias });

    store.dispatch(slice.actions.deleteVias(0));
    const state = store.getState()[slice.name];
    expect(state.vias).toStrictEqual([via2]);
  });

  it('should handle deleteItinerary', () => {
    const via1 = testDataBuilder.buildPointOnMap({ id: 'via-1' });
    const via2 = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    const vias = [via1, via2];

    const store = createStore(slice, {
      origin: via1,
      vias,
      destination: via2,
      geojson: testDataBuilder.buildGeoJson(),
      originTime: '08:00:00',
      pathfindingID: 1,
    });

    store.dispatch(slice.actions.deleteItinerary());
    const state = store.getState()[slice.name];
    expect(state.origin).toBe(undefined);
    expect(state.vias).toStrictEqual([]);
    expect(state.destination).toBe(undefined);
    expect(state.geojson).toBe(undefined);
    expect(state.originTime).toBe(undefined);
    expect(state.pathfindingID).toBe(undefined);
  });

  it('should handle destination', () => {
    const newDestination = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    defaultStore.dispatch(slice.actions.updateDestination(newDestination));
    const state = defaultStore.getState()[slice.name];
    expect(state.destination).toBe(newDestination);
  });

  it('should handle updateDestinationDate', () => {
    const newDestinationDate = '10/10/2023';
    defaultStore.dispatch(slice.actions.updateDestinationDate(newDestinationDate));
    const state = defaultStore.getState()[slice.name];
    expect(state.destinationDate).toBe(newDestinationDate);
  });

  it('should handle updateDestinationTime', () => {
    const newDestinationTime = '10:10:30';
    defaultStore.dispatch(slice.actions.updateDestinationTime(newDestinationTime));
    const state = defaultStore.getState()[slice.name];
    expect(state.destinationTime).toBe(newDestinationTime);
  });

  it('should handle updateItinerary', () => {
    const newItinerary = testDataBuilder.buildGeoJson();
    defaultStore.dispatch(slice.actions.updateItinerary(newItinerary));
    const state = defaultStore.getState()[slice.name];
    expect(state.geojson).toBe(newItinerary);
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

  it('should handle updatePowerRestrictionRanges', () => {
    const newPowerRestrictionRanges = testDataBuilder.buildPowerRestrictionRanges();
    defaultStore.dispatch(slice.actions.updatePowerRestrictionRanges(newPowerRestrictionRanges));
    const state = defaultStore.getState()[slice.name];
    expect(state.powerRestrictionRanges).toStrictEqual(newPowerRestrictionRanges);
  });

  it('should handle updateTrainScheduleIDsToModify', () => {
    const newTrainScheduleIDsToModify = [10, 2];
    defaultStore.dispatch(
      slice.actions.updateTrainScheduleIDsToModify(newTrainScheduleIDsToModify)
    );
    const state = defaultStore.getState()[slice.name];
    expect(state.trainScheduleIDsToModify).toStrictEqual(newTrainScheduleIDsToModify);
  });
};

export default testCommonConfReducers;
