import { beforeEach, it, expect } from 'vitest';

import {
  operationalStudiesConfSlice,
  operationalStudiesInitialConf,
  updateRollingStockName,
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
  const { toggleEditingTrainType: toggleEditingItemType } = slice.actions;

  const getState = () => defaultStore.getState()[operationalStudiesConfSlice.name];

  beforeEach(() => {
    defaultStore = createStore(operationalStudiesConfSlice);
  });

  it('should handle updateRollingStockName', () => {
    const newRollingStockName = 'rollingStock1';
    defaultStore.dispatch(updateRollingStockName(newRollingStockName));
    const state = getState();
    expect(state.rollingStockName).toBe(newRollingStockName);
  });

  it('should handle updateEditingItemType', () => {
    const newEditingItemType = 'pacedTrain';
    defaultStore.dispatch(toggleEditingItemType());
    const state = getState();
    expect(state.editingTrainType).toBe(newEditingItemType);
  });
};

export default testTrainSettingsReducer;
