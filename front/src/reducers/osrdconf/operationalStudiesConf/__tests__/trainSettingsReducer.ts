import { beforeEach, it, expect } from 'vitest';

import type { Distribution, TrainCategory, TrainSchedule } from 'common/api/osrdEditoastApi';
import {
  operationalStudiesConfSlice,
  operationalStudiesInitialConf,
} from 'reducers/osrdconf/operationalStudiesConf';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';
import { Duration } from 'utils/duration';

const createStore = (extraInitialState?: Partial<OperationalStudiesConfState>) =>
  createStoreWithoutMiddleware({
    [operationalStudiesConfSlice.name]: {
      ...operationalStudiesInitialConf,
      ...extraInitialState,
    },
  });

const testTrainSettingsReducer = () => {
  let defaultStore: ReturnType<typeof createStore>;
  const slice = operationalStudiesConfSlice;
  const {
    updateConstraintDistribution,
    updateName,
    toggleUsingElectricalProfiles,
    updateLabels,
    updateInitialSpeed,
    updateRollingStockComfort,
    updateStartTime,
    updateTimeWindow,
    updateInterval,
    updateCategory,
    toggleEditingItemType,
  } = slice.actions;

  const getState = () => defaultStore.getState()[operationalStudiesConfSlice.name];

  beforeEach(() => {
    defaultStore = createStore(operationalStudiesConfSlice);
  });

  it('should handle updateConstraintDistribution', () => {
    const newConstraintDistribution: Distribution = 'STANDARD';
    defaultStore.dispatch(updateConstraintDistribution(newConstraintDistribution));

    const state = getState();
    expect(state.constraintDistribution).toBe(newConstraintDistribution);
  });

  it('should handle updateName', () => {
    const newName = 'New Simulation Name';
    defaultStore.dispatch(updateName(newName));

    const state = getState();
    expect(state.name).toBe(newName);
  });

  it('should handle toggleUsingElectricalProfiles', () => {
    defaultStore.dispatch(toggleUsingElectricalProfiles());

    let state = getState();
    expect(state.usingElectricalProfiles).toBe(false);

    defaultStore.dispatch(toggleUsingElectricalProfiles());
    state = getState();
    expect(state.usingElectricalProfiles).toBe(true);
  });

  it('should handle updateLabels', () => {
    const newLabels = ['A', 'B'];
    defaultStore.dispatch(updateLabels(newLabels));
    const state = getState();
    expect(state.labels).toBe(newLabels);
  });

  it('should handle updateInitialSpeed', () => {
    const newInitialSpeed = 50;
    defaultStore.dispatch(updateInitialSpeed(newInitialSpeed));
    const state = getState();
    expect(state.initialSpeed).toBe(newInitialSpeed);
  });

  it('should handle updateCategory', () => {
    const newCategory: TrainCategory = { main_category: 'HIGH_SPEED_TRAIN' };
    defaultStore.dispatch(updateCategory(newCategory));
    const state = getState();
    expect(state.category).toBe(newCategory);
  });

  it('should handle updateRollingStockComfort', () => {
    const newRollingStockComfort: TrainSchedule['comfort'] = 'AIR_CONDITIONING';
    defaultStore.dispatch(updateRollingStockComfort(newRollingStockComfort));
    const state = getState();
    expect(state.rollingStockComfort).toBe(newRollingStockComfort);
  });

  it('should handle updateStartTime', () => {
    const newStartTime = new Date('2024-05-01T11:08:00.000+01:00');
    defaultStore.dispatch(updateStartTime(newStartTime));
    const state = getState();
    expect(state.startTime).toBe(newStartTime);
  });

  it('should handle updateTimeWindow', () => {
    const newTimeWindow = new Duration({ minutes: 60 });
    defaultStore.dispatch(updateTimeWindow(newTimeWindow));
    const state = getState();
    expect(state.timeWindow).toBe(newTimeWindow);
  });

  it('should handle updateInterval', () => {
    const newInterval = new Duration({ minutes: 30 });
    defaultStore.dispatch(updateInterval(newInterval));
    const state = getState();
    expect(state.interval).toBe(newInterval);
  });

  it('should handle updateEditingItemType', () => {
    const newEditingItemType = 'pacedTrain';
    defaultStore.dispatch(toggleEditingItemType());
    const state = getState();
    expect(state.editingItemType).toBe(newEditingItemType);
  });
};

export default testTrainSettingsReducer;
