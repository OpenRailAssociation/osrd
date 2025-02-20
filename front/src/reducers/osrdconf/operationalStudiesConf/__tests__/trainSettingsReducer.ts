import { beforeEach, it, expect } from 'vitest';

import type { Distribution, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import {
  operationalStudiesConfSlice,
  operationalStudiesInitialConf,
} from 'reducers/osrdconf/operationalStudiesConf';
import type { OperationalStudiesConfState } from 'reducers/osrdconf/types';
import { createStoreWithoutMiddleware } from 'store';

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
    updateTrainCount,
    updateTrainDelta,
    updateTrainStep,
    toggleUsingElectricalProfiles,
    updateLabels,
    updateInitialSpeed,
    updateRollingStockComfort,
    updateStartTime,
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

  it('should handle updateTrainCount', () => {
    const newTrainCount = 5;
    defaultStore.dispatch(updateTrainCount(newTrainCount));

    const state = getState();
    expect(state.trainCount).toBe(newTrainCount);
  });

  it('should handle updateTrainDelta', () => {
    const newTrainDelta = 5;
    defaultStore.dispatch(updateTrainDelta(newTrainDelta));

    const state = getState();
    expect(state.trainDelta).toBe(newTrainDelta);
  });

  it('should handle updateTrainStep', () => {
    const newTrainStep = 5;
    defaultStore.dispatch(updateTrainStep(newTrainStep));

    const state = getState();
    expect(state.trainStep).toBe(newTrainStep);
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

  it('should handle updateRollingStockComfort', () => {
    const newRollingStockComfort: TrainScheduleBase['comfort'] = 'AIR_CONDITIONING';
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
};

export default testTrainSettingsReducer;
