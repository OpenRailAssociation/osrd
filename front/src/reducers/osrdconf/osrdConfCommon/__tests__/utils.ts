import { describe, beforeEach, it, expect } from 'vitest';

import type { Infra } from 'common/api/osrdEditoastApi';
import type { OperationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import { defaultCommonConf } from 'reducers/osrdconf/osrdConfCommon';
import type { StdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import type { OsrdConfState } from 'reducers/osrdconf/types';
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
  let defaultStore: ReturnType<typeof createStore>;

  beforeEach(() => {
    defaultStore = createStore(slice);
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
};

export default testCommonConfReducers;
