import React from 'react';

import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import useStdcm from 'applications/stdcm/hooks/useStdcm';
import type { StdcmSimulation } from 'applications/stdcmV2/types';
import { useOsrdConfActions, StdcmTestLayout } from 'common/osrdContext';
import * as osrdContext from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { createStore } from 'store';

import server from './server';
import useView from '../useView';

vi.mock('applications/stdcm/hooks/useStdcm');

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
    beforeEach(() => {
      // tell vitest we use mocked time
      vi.useFakeTimers();
    });

    afterEach(() => {
      // restoring date after each test run
      vi.useRealTimers();
    });

    const mockedDipatch = vi.spyOn(store, 'dispatch');

    it.only('should set rollingStockId, speedLimitByTag, pathSteps, originDate, and originTime when a simulation is selected', () => {
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

    it.only('should show status banner when siulation failed', () => {
      vi.mocked(useStdcm).mockReturnValue({
        isRejected: true,
        isStdcmResultsEmpty: false,
        pathProperties: { length: 403 } as ManageTrainSchedulePathProperties,
        launchStdcmRequest: () => {},
      } as ReturnType<typeof useStdcm>);

      const { result, rerender } = renderHook(() => useView(), { wrapper });

      expect(result.current.pathProperties).toStrictEqual({ length: 403 });
      expect(result.current.selectedSimulationIndex).toBe(-1);
      vi.mocked(useStdcm).mockReturnValue({
        isRejected: false,
        isStdcmResultsEmpty: false,
        pathProperties: { length: 404 } as ManageTrainSchedulePathProperties,
        stdcmV2Results: { stdcmResponse: {} },
      } as ReturnType<typeof useStdcm>);

      rerender();

      const date = new Date();
      vi.setSystemTime(date);

      expect(result.current.simulationsList[0]).toStrictEqual({
        id: 1,
        creationDate: new Date(),
        inputs: {
          pathSteps: [null, null],
        },
        outputs: {
          results: {},
          pathProperties: { length: 404 },
        },
      });

      expect(result.current.simulationsList.length).toBe(1);
      expect(result.current.selectedSimulationIndex).toBe(0);
      expect(result.current.showStatusBanner).toBe(true);
    });
  });
});
