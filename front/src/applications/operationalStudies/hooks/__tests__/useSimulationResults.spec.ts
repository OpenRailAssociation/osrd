import { cleanup, waitFor } from '@testing-library/react';
import { renderHookWithStore } from 'store/__tests__';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { mockOsrdEditoastEndpoints } from 'common/api/__mocks__/osrdEditoastApi';
import type {
  PacedTrainException,
  PathfindingResult,
  PathProperties,
  RollingStockWithLiveries,
  SimulationResponse,
} from 'common/api/osrdEditoastApi';

import useSimulationResults from '../useSimulationResults';

const INFRA_ID = 12;
const ELECTRICAL_PROFILE_SET_ID = 34;
const PACED_TRAIN_ID = 'paced_1';
const EXCEPTION_KEY = 'exc_1';
const OCCURRENCE_ID = 'indexedoccurrence_1_1';
const ADDED_EXCEPTION_ID = 'exception_1_99';
const ROLLING_STOCK_NAME = 'fast-rs';
const PACED_INTERVAL = 'PT15M';

const notFoundError = {
  status: 404,
  data: { type: 'not_found', message: 'Not found', context: {} },
};

const {
  getTrainPath,
  getTrainSimulation,
  getRollingStockNameByRollingStockName,
  postInfraByInfraIdPathProperties,
} = mockOsrdEditoastEndpoints;

const { mockGetSelectedTrain, mockUseScenarioContext, mockUseSelectedTrainSchedule } = vi.hoisted(
  () => ({
    mockGetSelectedTrain: vi.fn(),
    mockUseScenarioContext: vi.fn(),
    mockUseSelectedTrainSchedule: vi.fn(),
  })
);

vi.mock('reducers/simulationResults/selectors', () => ({
  getSelectedTrain: mockGetSelectedTrain,
}));

vi.mock('../useScenarioContext', () => ({
  useScenarioContext: mockUseScenarioContext,
}));

vi.mock('modules/trainSchedule/hooks/useSelectedTrainSchedule', () => ({
  default: mockUseSelectedTrainSchedule,
}));

describe.skip('useSimulationResults', () => {
  const baseTrain = {
    id: 1,
    start_time: '2026-03-16T08:00:00.000Z',
    rolling_stock_name: ROLLING_STOCK_NAME,
    path: [],
    paced: undefined,
    train_name: 'Train 1',
  };

  // What the hook produces from baseTrain after formatEditoastIdToPacedTrainId()
  const expectedTrain = { ...baseTrain, id: PACED_TRAIN_ID };

  const pacedTrainSchedule = {
    ...baseTrain,
    paced: {
      interval: PACED_INTERVAL,
      exceptions: [] as PacedTrainException[],
    },
  };

  const simulationSuccess = {
    status: 'success',
    electrical_profiles: {
      boundaries: [],
      values: [{ electrical_profile_type: 'no_profile' }],
    },
  } as unknown as SimulationResponse;

  const rollingStock = {
    name: ROLLING_STOCK_NAME,
    effort_curves: { modes: {} },
  } as RollingStockWithLiveries;

  const trackSectionRanges = [
    { track_section: 'TS1', begin: 0, end: 1000, direction: 'START_TO_STOP' },
  ];

  const pathfindingSuccess = {
    status: 'success',
    length: 1000,
    path_item_positions: [0, 1000],
    path: { track_section_ranges: trackSectionRanges },
  } as PathfindingResult;

  const rawPathProperties = {
    curves: { boundaries: [], values: [0] },
    electrifications: { boundaries: [], values: [{ type: 'non_electrified' }] },
    geometry: { type: 'LineString', coordinates: [] },
    operational_points: [],
    slopes: { boundaries: [], values: [0] },
  } as unknown as PathProperties;

  const preparedPathPropertiesBase = {
    curves: [
      { position: 0, radius: 0 },
      { position: 1, radius: 0 },
    ],
    slopes: [
      { position: 0, gradient: 0 },
      { position: 1, gradient: 0 },
    ],
    operationalPoints: [],
    geometry: { type: 'LineString', coordinates: [] },
  };

  // When simulation fails, electrical_profiles aren't passed
  const preparedPathProperties = {
    ...preparedPathPropertiesBase,
    electrifications: [],
    voltages: [],
  };

  // When simulation succeeds, electrical_profiles merge into electrifications
  const preparedPathPropertiesWithElectrification = {
    ...preparedPathPropertiesBase,
    electrifications: [
      {
        electrificationUsage: {
          electrical_profile_type: 'no_profile',
          type: 'non_electrified',
        },
        start: 0,
        stop: 1,
      },
    ],
    voltages: [{ begin: 0, end: 1000, value: '' }],
  };

  const renderUseSimulationResults = () =>
    renderHookWithStore(() => useSimulationResults(undefined));

  const pacedScheduleWith = (exceptions: PacedTrainException[]) => ({
    ...pacedTrainSchedule,
    paced: { interval: PACED_INTERVAL, exceptions },
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseScenarioContext.mockReturnValue({
      infraId: INFRA_ID,
      electricalProfileSetId: ELECTRICAL_PROFILE_SET_ID,
    });
    mockGetSelectedTrain.mockReturnValue({ id: PACED_TRAIN_ID });
    mockUseSelectedTrainSchedule.mockReturnValue(baseTrain);

    getTrainPath.mockResolvedValue({ data: pathfindingSuccess });
    getTrainSimulation.mockResolvedValue({ data: simulationSuccess });
    getRollingStockNameByRollingStockName.mockResolvedValue({
      data: rollingStock,
    });
    postInfraByInfraIdPathProperties.mockResolvedValue({
      data: rawPathProperties,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('when no train can be resolved', () => {
    it('should return no results when no selected train id is available', async () => {
      mockGetSelectedTrain.mockReturnValue(undefined);

      const { result } = renderUseSimulationResults();

      await waitFor(() => expect(result.current.isSimulationDataLoading).toBe(false));
      expect(result.current.results).toBeUndefined();
    });

    it('should return no results when no timetable item is available', async () => {
      mockUseSelectedTrainSchedule.mockReturnValue(undefined);

      const { result } = renderUseSimulationResults();

      await waitFor(() => expect(result.current.isSimulationDataLoading).toBe(false));
      expect(result.current.results).toBeUndefined();
    });
  });

  it('should return a valid simulation result for a standard train', async () => {
    const { result } = renderUseSimulationResults();

    await waitFor(() => {
      expect(result.current.results?.isValid).toBe(true);
      expect(getTrainPath).toHaveBeenCalledWith({
        id: PACED_TRAIN_ID,
        infraId: INFRA_ID,
        exceptionId: undefined,
      });
      expect(getTrainSimulation).toHaveBeenCalledWith({
        id: PACED_TRAIN_ID,
        infraId: INFRA_ID,
        electricalProfileSetId: ELECTRICAL_PROFILE_SET_ID,
        exceptionId: undefined,
      });
      expect(getRollingStockNameByRollingStockName).toHaveBeenCalledWith({
        rollingStockName: ROLLING_STOCK_NAME,
      });
      expect(postInfraByInfraIdPathProperties).toHaveBeenCalledWith({
        infraId: INFRA_ID,
        pathPropertiesInput: { track_section_ranges: trackSectionRanges },
      });
      expect(result.current).toEqual({
        results: {
          isValid: true,
          train: expectedTrain,
          rollingStock,
          simulation: simulationSuccess,
          path: pathfindingSuccess,
          pathProperties: preparedPathPropertiesWithElectrification,
          powerRestrictions: [],
        },
        isSimulationDataLoading: false,
      });
    });
  });

  describe('when data is incomplete', () => {
    it.each([
      {
        case: 'rolling stock is missing',
        arrange: () =>
          getRollingStockNameByRollingStockName.mockResolvedValue({
            error: notFoundError,
          }),
        expectedResults: {
          isValid: false,
          train: expectedTrain,
          path: pathfindingSuccess,
          rollingStock: undefined,
        },
      },
      {
        case: 'path properties are missing',
        arrange: () =>
          postInfraByInfraIdPathProperties.mockResolvedValue({
            error: notFoundError,
          }),
        expectedResults: {
          isValid: false,
          train: expectedTrain,
          path: pathfindingSuccess,
          rollingStock,
        },
      },
      {
        case: 'pathfinding has failed',
        arrange: () => getTrainPath.mockResolvedValue({ error: notFoundError }),
        expectedResults: {
          isValid: false,
          train: expectedTrain,
          path: undefined,
          rollingStock,
        },
      },
      {
        case: 'simulation is not successful',
        arrange: () => getTrainSimulation.mockResolvedValue({ error: notFoundError }),
        expectedResults: {
          isValid: false,
          train: expectedTrain,
          path: pathfindingSuccess,
          rollingStock,
          pathProperties: preparedPathProperties,
        },
      },
    ])('should return an invalid result when $case', async ({ arrange, expectedResults }) => {
      arrange();

      const { result } = renderUseSimulationResults();

      await waitFor(() => expect(result.current.isSimulationDataLoading).toBe(false));
      expect(result.current.results).toEqual(expectedResults);
    });
  });

  describe('when handling paced train occurrences', () => {
    beforeEach(() => {
      mockGetSelectedTrain.mockReturnValue({ id: OCCURRENCE_ID });
    });

    it('should return no results when the selected occurrence is disabled', async () => {
      mockUseSelectedTrainSchedule.mockReturnValue(
        pacedScheduleWith([{ key: EXCEPTION_KEY, occurrence_index: 1, disabled: true }])
      );

      const { result } = renderUseSimulationResults();

      await waitFor(() => {
        expect(result.current.isSimulationDataLoading).toBe(false);
        expect(result.current.results).toBeUndefined();
        expect(getTrainPath).toHaveBeenCalledWith({
          id: OCCURRENCE_ID,
          infraId: INFRA_ID,
          exceptionId: undefined,
        });
        expect(getTrainSimulation).toHaveBeenCalledWith({
          id: OCCURRENCE_ID,
          infraId: INFRA_ID,
          electricalProfileSetId: ELECTRICAL_PROFILE_SET_ID,
          exceptionId: undefined,
        });
      });
    });

    it('should build the selected occurrence from exception data and pass exceptionId to queries', async () => {
      const exceptionId = 99;
      mockUseSelectedTrainSchedule.mockReturnValue(
        pacedScheduleWith([
          {
            key: EXCEPTION_KEY,
            id: exceptionId,
            occurrence_index: 1,
            disabled: false,
            start_time: { value: 32_400_000 },
          },
        ])
      );

      const { result } = renderUseSimulationResults();

      await waitFor(() => {
        expect(result.current.results?.isValid).toBe(true);
        expect(getTrainPath).toHaveBeenCalledWith({
          id: OCCURRENCE_ID,
          infraId: INFRA_ID,
          exceptionId,
        });
        expect(getTrainSimulation).toHaveBeenCalledWith({
          id: OCCURRENCE_ID,
          infraId: INFRA_ID,
          electricalProfileSetId: ELECTRICAL_PROFILE_SET_ID,
          exceptionId,
        });
        expect(result.current.results).toMatchObject({
          isValid: true,
          train: {
            id: OCCURRENCE_ID,
            start_time: 32400000,
            // occurrence name derived from the paced train name 'Train 1': the trailing
            // number is bumped by 2 * occurrenceIndex (1 + 2*1)
            train_name: 'Train 3',
          },
        });
      });
    });

    it('should resolve an added exception by id, even alongside an indexed occurrence', async () => {
      const exceptionId = 99;
      mockGetSelectedTrain.mockReturnValue({ id: ADDED_EXCEPTION_ID });
      mockUseSelectedTrainSchedule.mockReturnValue(
        pacedScheduleWith([
          // an indexed occurrence the hook must NOT pick
          {
            key: 'exc_indexed',
            id: 1,
            occurrence_index: 1,
            disabled: false,
            start_time: { value: 1_000 },
            train_name: { value: 'Indexed occurrence' },
          },
          // the added exception the hook must resolve
          {
            key: EXCEPTION_KEY,
            id: exceptionId,
            disabled: false,
            start_time: { value: 32_400_000 },
          },
        ])
      );

      const { result } = renderUseSimulationResults();

      await waitFor(() => {
        expect(result.current.results?.isValid).toBe(true);
        expect(getTrainPath).toHaveBeenCalledWith({
          id: ADDED_EXCEPTION_ID,
          infraId: INFRA_ID,
          exceptionId,
        });
        expect(getTrainSimulation).toHaveBeenCalledWith({
          id: ADDED_EXCEPTION_ID,
          infraId: INFRA_ID,
          electricalProfileSetId: ELECTRICAL_PROFILE_SET_ID,
          exceptionId,
        });
        expect(result.current.results).toMatchObject({
          isValid: true,
          train: {
            id: ADDED_EXCEPTION_ID,
            start_time: 32400000,
            train_name: 'Train 1/+',
          },
        });
      });
    });

    it.each([
      {
        case: 'the exception does not define one',
        selectedId: 'indexedoccurrence_1_42',
        exception: {
          key: EXCEPTION_KEY,
          occurrence_index: 42,
          disabled: false,
        },
        expectedStartTime: 1773685800000,
      },
      {
        case: 'no exception matches the occurrence id',
        selectedId: 'indexedoccurrence_1_5',
        exception: { key: EXCEPTION_KEY, occurrence_index: 1 },
        expectedStartTime: 1773652500000,
      },
    ])(
      'should compute the occurrence start time when $case',
      async ({ selectedId, exception, expectedStartTime }) => {
        mockGetSelectedTrain.mockReturnValue({ id: selectedId });
        mockUseSelectedTrainSchedule.mockReturnValue(pacedScheduleWith([exception]));

        const { result } = renderUseSimulationResults();

        await waitFor(() => expect(result.current.results?.isValid).toBe(true));
        expect(result.current.results).toMatchObject({
          isValid: true,
          train: { id: selectedId, start_time: expectedStartTime },
        });
      }
    );
  });

  describe('loading state', () => {
    // RTK-Query's queryFn is sync-typed; a never-resolving promise is the
    // simplest way to pin isFetching = true. The cast bridges that.
    const pending = new Promise<never>(() => {}) as never;

    it.each([
      { case: 'path query', mock: () => getTrainPath.mockReturnValue(pending) },
      {
        case: 'simulation query',
        mock: () => getTrainSimulation.mockReturnValue(pending),
      },
      {
        case: 'path properties query',
        mock: () => postInfraByInfraIdPathProperties.mockReturnValue(pending),
      },
    ])('should return loading=true when the $case is still fetching', async ({ mock }) => {
      mock();

      const { result } = renderUseSimulationResults();

      await waitFor(() => expect(result.current.isSimulationDataLoading).toBe(true));
    });
  });

  it('should refetch and update results when the selected train id changes', async () => {
    const { result, rerender } = renderUseSimulationResults();

    await waitFor(() => expect(result.current.results?.train.id).toBe(PACED_TRAIN_ID));

    mockGetSelectedTrain.mockReturnValue({ id: 'paced_2' });
    mockUseSelectedTrainSchedule.mockReturnValue({ ...baseTrain, id: 2 });
    rerender();

    await waitFor(() => {
      expect(result.current.results?.train.id).toBe('paced_2');
      expect(getTrainPath).toHaveBeenLastCalledWith({
        id: 'paced_2',
        infraId: INFRA_ID,
        exceptionId: undefined,
      });
    });
  });
});
