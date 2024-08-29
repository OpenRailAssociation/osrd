import React from 'react';

import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';

import type { StdcmSimulation } from 'applications/stdcmV2/types';
import { useOsrdConfActions, StdcmTestLayout } from 'common/osrdContext';
import * as osrdContext from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { createStore } from 'store';

import server from './server';
import useView from '../useView';

const store = createStore();

const wrapper = (props: { children: React.ReactNode }) => (
  <Provider store={store}>
    <StdcmTestLayout>{props.children}</StdcmTestLayout>
  </Provider>
);

describe('useView', () => {
  beforeAll(async () => {
    server.listen();
  });

  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe('simulation selection', () => {
    const mockedDipatch = vi.spyOn(store, 'dispatch');

    it('should set rollingStockId, speedLimitByTag, pathSteps, originDate, and originTime when a simulation is selected', () => {
      // Arrange
      const initialSimulationsList: StdcmSimulation[] = [
        {
          id: 1,
          creationDate: new Date(),
          inputs: {
            consist: {
              speedLimitByTag: 'speedLimitByTag',
            },
            departureDate: 'departureDate',
            departureTime: 'departureTime',
            pathSteps: [null, null],
          },
        },
      ];
      const selectedSimulation = initialSimulationsList[0];
      const { result } = renderHook(() => useView({ initialSimulationsList }), { wrapper });
      const contextHook = renderHook(() => useOsrdConfActions(), { wrapper });

      // Act
      act(() => {
        result.current.handleSelectSimulation(0);
      });

      // Assert
      expect(result.current.selectedSimulationIndex).toBe(0);
      expect(result.current.showBtnToLaunchSimulation).toBe(false);
      expect(mockedDipatch).toHaveBeenCalledWith(
        (contextHook.result.current as StdcmConfSliceActions).updateStdcmConfigWithData({
          rollingStockID: selectedSimulation.inputs.consist?.tractionEngine?.id,
          speedLimitByTag: selectedSimulation.inputs.consist?.speedLimitByTag,
          pathSteps: [...selectedSimulation.inputs.pathSteps],
          originDate: selectedSimulation.inputs.departureDate,
          originTime: selectedSimulation.inputs.departureTime,
        })
      );
      // expect(stdcmConfStore.rollingStockID).toBe(
      //   selectedSimulation.inputs.consist?.tractionEngine?.id
      // );
      // expect(stdcmConfStore.speedLimitByTag).toBe(
      //   selectedSimulation.inputs.consist?.speedLimitByTag
      // );
      // expect(stdcmConfStore.pathSteps).toEqual(selectedSimulation.inputs.pathSteps);
      // expect(stdcmConfStore.originDate).toBe(selectedSimulation.inputs.departureDate);
    });

    // it('should show status banner when siulation failed', () => {
    //   const { result } = renderHook(() => useView(), { wrapper });
    //   act(() => {
    //     result.current.launchStdcmRequest();
    //   });

    //   expect(result.current.showStatusBanner).toBe(true);
    //   expect(result.current.simulationsList.length).toBe(0);
    // });
  });
});
