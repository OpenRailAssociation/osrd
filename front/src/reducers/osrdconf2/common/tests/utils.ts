import { OsrdConfState, PointOnMap } from 'applications/operationalStudies/consts';
import { Allowance } from 'common/api/osrdEditoastApi';
import { omit } from 'lodash';
import { createStoreWithoutMiddleware } from 'Store';
import { defaultCommonConf } from '..';
import { simulationConfSliceType } from '../../simulationConf';
import { stdcmConfSliceType } from '../../stdcmConf';
import commonConfBuilder from './commonConfBuilder';

function createStore(
  slice: simulationConfSliceType | stdcmConfSliceType,
  initialStateExtra: Partial<OsrdConfState> = {}
) {
  return createStoreWithoutMiddleware({
    [slice.name]: { ...defaultCommonConf, ...initialStateExtra },
  });
}

const testCommonConfReducers = (slice: simulationConfSliceType | stdcmConfSliceType) => {
  const testDataBuilder = commonConfBuilder();

  it('should handle updateName', () => {
    const store = createStore(slice);
    const newName = 'New Simulation Name';
    store.dispatch(slice.actions.updateName(newName));

    const state = store.getState()[slice.name];
    expect(state.name).toBe(newName);
  });

  it('should handle updateTrainCount', () => {
    const store = createStore(slice);
    const newTrainCount = 5;
    store.dispatch(slice.actions.updateTrainCount(newTrainCount));

    const state = store.getState()[slice.name];
    expect(state.trainCount).toBe(newTrainCount);
  });

  it('should handle update', () => {
    const store = createStore(slice);
    const newTrainDelta = 5;
    store.dispatch(slice.actions.updateTrainDelta(newTrainDelta));

    const state = store.getState()[slice.name];
    expect(state.trainDelta).toBe(newTrainDelta);
  });

  it('should handle updateTrainStep', () => {
    const store = createStore(slice);
    const newTrainStep = 5;
    store.dispatch(slice.actions.updateTrainStep(newTrainStep));

    const state = store.getState()[slice.name];
    expect(state.trainStep).toBe(newTrainStep);
  });

  it('should handle updateAllowances', () => {
    const store = createStore(slice);
    const newAllowances: Allowance[] = [
      testDataBuilder.buildEngineeringAllowance(),
      testDataBuilder.buildStandardAllowance(),
    ];
    store.dispatch(slice.actions.updateAllowances(newAllowances));

    const state = store.getState()[slice.name];
    expect(state.allowances).toBe(newAllowances);
  });

  it('should handle toggleUsingElectricalProfiles', () => {
    const store = createStore(slice);
    store.dispatch(slice.actions.toggleUsingElectricalProfiles());

    let state = store.getState()[slice.name];
    expect(state.usingElectricalProfiles).toBe(false);

    store.dispatch(slice.actions.toggleUsingElectricalProfiles());
    state = store.getState()[slice.name];
    expect(state.usingElectricalProfiles).toBe(true);
  });

  it('should handle updateLabels', () => {
    const store = createStore(slice);
    const newLabels = ['A', 'B'];
    store.dispatch(slice.actions.updateLabels(newLabels));
    const state = store.getState()[slice.name];
    expect(state.labels).toBe(newLabels);
  });

  it('should handle updateProjectID', () => {
    const store = createStore(slice);
    const newProjectID = 5;
    store.dispatch(slice.actions.updateProjectID(newProjectID));
    const state = store.getState()[slice.name];
    expect(state.projectID).toBe(newProjectID);
  });

  it('should handle updateStudyID', () => {
    const store = createStore(slice);
    const newStudyID = 5;
    store.dispatch(slice.actions.updateStudyID(newStudyID));
    const state = store.getState()[slice.name];
    expect(state.studyID).toBe(newStudyID);
  });

  it('should handle updateScenarioID', () => {
    const store = createStore(slice);
    const newScenarioID = 5;
    store.dispatch(slice.actions.updateScenarioID(newScenarioID));
    const state = store.getState()[slice.name];
    expect(state.scenarioID).toBe(newScenarioID);
  });

  describe('should handle updateInfraID', () => {
    it('should update infraID', () => {
      const store = createStore(slice);
      const newInfraID = 5;
      store.dispatch(slice.actions.updateInfraID(newInfraID));
      const state = store.getState()[slice.name];
      expect(state.infraID).toBe(newInfraID);
    });
  });

  it('should handle updatePathfindingID', () => {
    const store = createStore(slice);
    const newPathfindingID = 1;
    store.dispatch(slice.actions.updatePathfindingID(newPathfindingID));
    const state = store.getState()[slice.name];
    expect(state.pathfindingID).toBe(newPathfindingID);
    expect(state.powerRestrictionRanges).toStrictEqual([]);
  });

  it('should handle updateTimetableID', () => {
    const store = createStore(slice);
    const newTimetableID = 1;
    store.dispatch(slice.actions.updateTimetableID(newTimetableID));
    const state = store.getState()[slice.name];
    expect(state.timetableID).toBe(newTimetableID);
  });

  it('should handle updateRollingStockID', () => {
    const store = createStore(slice);
    const newRollingStockID = 1;
    store.dispatch(slice.actions.updateRollingStockID(newRollingStockID));
    const state = store.getState()[slice.name];
    expect(state.rollingStockID).toBe(newRollingStockID);
  });

  it('should handle updateRollingStockComfort', () => {
    const store = createStore(slice);
    const newRollingStockComfort = 'AC';
    store.dispatch(slice.actions.updateRollingStockComfort(newRollingStockComfort));
    const state = store.getState()[slice.name];
    expect(state.rollingStockComfort).toBe(newRollingStockComfort);
  });

  it('should handle updateSpeedLimitByTag', () => {
    const store = createStore(slice);
    const newSpeedLimitByTag = 'test-tag';
    store.dispatch(slice.actions.updateSpeedLimitByTag(newSpeedLimitByTag));
    const state = store.getState()[slice.name];
    expect(state.speedLimitByTag).toBe(newSpeedLimitByTag);
  });

  it('should handle updateOrigin', () => {
    const store = createStore(slice);
    const newOrigin = testDataBuilder.buildPointOnMap();
    store.dispatch(slice.actions.updateOrigin(newOrigin));
    const state = store.getState()[slice.name];
    expect(state.origin).toBe(newOrigin);
  });

  it('should handle updateInitialSpeed', () => {
    const store = createStore(slice);
    const newInitialSpeed = 50;
    store.dispatch(slice.actions.updateInitialSpeed(newInitialSpeed));
    const state = store.getState()[slice.name];
    expect(state.initialSpeed).toBe(newInitialSpeed);
  });

  it('should handle updateDepartureTime', () => {
    const store = createStore(slice);
    const newDepartureTime = '09:00:00';
    store.dispatch(slice.actions.updateDepartureTime(newDepartureTime));
    const state = store.getState()[slice.name];
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
    it('set to false if true ', () => {
      const store = createStore(slice, { originLinkedBounds: true });
      store.dispatch(slice.actions.toggleOriginLinkedBounds());
      const state = store.getState()[slice.name];
      expect(state.originLinkedBounds).toBe(false);
    });

    it('set to true if false ', () => {
      const store = createStore(slice, { originLinkedBounds: false });

      store.dispatch(slice.actions.toggleOriginLinkedBounds());
      const state = store.getState()[slice.name];
      expect(state.originLinkedBounds).toBe(true);
    });
  });

  it('should handle updateOriginDate', () => {
    const store = createStore(slice);
    const newOriginDate = '13/12/2023';
    store.dispatch(slice.actions.updateOriginDate(newOriginDate));
    const state = store.getState()[slice.name];
    expect(state.originDate).toBe(newOriginDate);
  });

  it('should handle updateOriginUpperBoundDate', () => {
    const store = createStore(slice);
    const newOriginUpperBoundDate = '13/12/2023';
    store.dispatch(slice.actions.updateOriginUpperBoundDate(newOriginUpperBoundDate));
    const state = store.getState()[slice.name];
    expect(state.originUpperBoundDate).toBe(newOriginUpperBoundDate);
  });

  it('should handle replaceVias', () => {
    const store = createStore(slice);
    const newVias: PointOnMap[] = [testDataBuilder.buildPointOnMap()];
    store.dispatch(slice.actions.replaceVias(newVias));
    const state = store.getState()[slice.name];
    expect(state.vias).toBe(newVias);
  });

  it('should handle updateVias', () => {
    const via1 = testDataBuilder.buildPointOnMap({ id: 'via-1' });
    const via2 = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    const store = createStore(slice, {
      vias: [via1],
    });

    store.dispatch(slice.actions.updateVias(via2));
    const state = store.getState()[slice.name];
    expect(state.vias).toStrictEqual([via1, via2]);
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
    const store = createStore(slice);
    const via1 = testDataBuilder.buildPointOnMap({ id: 'via-1' });
    const via2 = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    const vias = [via1, via2];
    store.dispatch(slice.actions.updateSuggeredVias(vias));
    const state = store.getState()[slice.name];
    expect(state.suggeredVias).toStrictEqual(vias);
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
    const store = createStore(slice);
    const newDestination = testDataBuilder.buildPointOnMap({ id: 'via-2' });
    store.dispatch(slice.actions.updateDestination(newDestination));
    const state = store.getState()[slice.name];
    expect(state.destination).toBe(newDestination);
  });

  it('should handle updateDestinationDate', () => {
    const store = createStore(slice);
    const newDestinationDate = '10/10/2023';
    store.dispatch(slice.actions.updateDestinationDate(newDestinationDate));
    const state = store.getState()[slice.name];
    expect(state.destinationDate).toBe(newDestinationDate);
  });

  it('should handle updateDestinationTime', () => {
    const store = createStore(slice);
    const newDestinationTime = '10:10:30';
    store.dispatch(slice.actions.updateDestinationTime(newDestinationTime));
    const state = store.getState()[slice.name];
    expect(state.destinationTime).toBe(newDestinationTime);
  });

  it('should handle updateItinerary', () => {
    const store = createStore(slice);
    const newItinerary = testDataBuilder.buildGeoJson();
    store.dispatch(slice.actions.updateItinerary(newItinerary));
    const state = store.getState()[slice.name];
    expect(state.geojson).toBe(newItinerary);
  });

  it('should handle updateFeatureInfoClickOSRD', () => {
    const store = createStore(slice);
    const newFeatureClick = testDataBuilder.buildFeatureInfoClick();
    store.dispatch(slice.actions.updateFeatureInfoClickOSRD(newFeatureClick));
    const state = store.getState()[slice.name];
    expect(state.featureInfoClick).toStrictEqual({
      ...newFeatureClick,
      feature: omit(newFeatureClick.feature, ['_vectorTileFeature']),
    });
  });

  it('should handle updateGridMarginBefore', () => {
    const store = createStore(slice);
    const newGridMarginBefore = 5;
    store.dispatch(slice.actions.updateGridMarginBefore(newGridMarginBefore));
    const state = store.getState()[slice.name];
    expect(state.gridMarginBefore).toStrictEqual(newGridMarginBefore);
  });

  it('should handle updateGridMarginAfter', () => {
    const store = createStore(slice);
    const newGridMarginAfter = 5;
    store.dispatch(slice.actions.updateGridMarginAfter(newGridMarginAfter));
    const state = store.getState()[slice.name];
    expect(state.gridMarginAfter).toStrictEqual(newGridMarginAfter);
  });

  it('should handle updatePowerRestrictionRanges', () => {
    const store = createStore(slice);
    const newPowerRestrictionRanges = testDataBuilder.buildPowerRestrictionRanges();
    store.dispatch(slice.actions.updatePowerRestrictionRanges(newPowerRestrictionRanges));
    const state = store.getState()[slice.name];
    expect(state.powerRestrictionRanges).toStrictEqual(newPowerRestrictionRanges);
  });

  it('should handle updateTrainScheduleIDsToModify', () => {
    const store = createStore(slice);
    const newTrainScheduleIDsToModify = [10, 2];
    store.dispatch(slice.actions.updateTrainScheduleIDsToModify(newTrainScheduleIDsToModify));
    const state = store.getState()[slice.name];
    expect(state.trainScheduleIDsToModify).toStrictEqual(newTrainScheduleIDsToModify);
  });
};

export default testCommonConfReducers;
