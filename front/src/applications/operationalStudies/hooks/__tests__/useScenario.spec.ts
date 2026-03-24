import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import useScenario from '../useScenario';

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  dispatch: vi.fn(),
  updateInfraID: vi.fn((id: number | undefined) => ({
    type: 'operationalStudiesConf/updateInfraID',
    payload: id,
  })),
  updateTrainIdUsedForProjection: vi.fn((id: unknown) => ({
    type: 'simulationResults/updateTrainIdUsedForProjection',
    payload: id,
  })),
  useGetScenario: vi.fn(),
  useGetTrainScheduleSets: vi.fn(),
  postTrainScheduleSets: vi.fn(),
  linkTrainScheduleSets: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: mocks.useParams,
}));

vi.mock('store', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('common/osrdContext', () => ({
  useOsrdConfActions: () => ({ updateInfraID: mocks.updateInfraID }),
}));

vi.mock('reducers/simulationResults', () => ({
  updateTrainIdUsedForProjection: mocks.updateTrainIdUsedForProjection,
}));

vi.mock('common/api/osrdEditoastApi', () => ({
  osrdEditoastApi: {
    endpoints: {
      getScenariosByScenarioId: { useQuery: mocks.useGetScenario },
      getTimetableByIdTrainScheduleSets: { useQuery: mocks.useGetTrainScheduleSets },
      postTrainScheduleSets: { useMutation: () => [mocks.postTrainScheduleSets] },
      postTimetableByIdTrainScheduleSets: { useMutation: () => [mocks.linkTrainScheduleSets] },
    },
  },
}));

const mockScenario = {
  id: 42,
  infra_id: 10,
  timetable_id: 100,
  name: 'Test Scenario',
};

describe('useScenario', () => {
  beforeEach(() => {
    mocks.useParams.mockReturnValue({ scenarioId: '42' });
    mocks.useGetScenario.mockReturnValue({
      data: undefined,
      isError: false,
      error: undefined,
    });
    mocks.useGetTrainScheduleSets.mockReturnValue({ currentData: undefined });
    mocks.postTrainScheduleSets.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ id: 999 }),
    });
    mocks.linkTrainScheduleSets.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return the scenario and dispatch updateInfraID with the infra_id', () => {
    mocks.useGetScenario.mockReturnValue({
      data: mockScenario,
      isError: false,
      error: undefined,
    });
    mocks.useGetTrainScheduleSets.mockReturnValue({ currentData: [] });

    const { result } = renderHook(() => useScenario());

    expect(result.current.scenario).toEqual(mockScenario);
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'operationalStudiesConf/updateInfraID',
      payload: mockScenario.infra_id,
    });
  });

  it('should return existing sandboxId when a nameless train schedule set exists', () => {
    const sandbox = { id: 55, name: null };
    mocks.useGetScenario.mockReturnValue({
      data: mockScenario,
      isError: false,
      error: undefined,
    });
    mocks.useGetTrainScheduleSets.mockReturnValue({
      currentData: [sandbox],
    });

    const { result } = renderHook(() => useScenario());

    expect(result.current.sandboxId).toBe(55);
    expect(mocks.postTrainScheduleSets).not.toHaveBeenCalled();
  });

  it('should create a new sandbox and link it to the timetable when none exists', async () => {
    const namedTss = { id: 10, name: 'Named set' };
    mocks.useGetScenario.mockReturnValue({
      data: mockScenario,
      isError: false,
      error: undefined,
    });
    mocks.useGetTrainScheduleSets.mockReturnValue({
      currentData: [namedTss],
    });

    const { result } = renderHook(() => useScenario());

    await waitFor(() => expect(result.current.sandboxId).toBe(999));
    expect(mocks.postTrainScheduleSets).toHaveBeenCalledWith({
      trainScheduleSetForm: { name: null, description: '', published: false },
    });
    expect(mocks.linkTrainScheduleSets).toHaveBeenCalledWith({
      id: mockScenario.timetable_id,
      body: { train_schedule_set_ids: [999] },
    });
  });

  it('should reset infraID and trainIdUsedForProjection when no scenario is loaded', () => {
    mocks.useGetScenario.mockReturnValue({
      data: undefined,
      isError: false,
      error: undefined,
    });
    mocks.useGetTrainScheduleSets.mockReturnValue({ currentData: undefined });

    renderHook(() => useScenario());

    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'operationalStudiesConf/updateInfraID',
      payload: undefined,
    });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'simulationResults/updateTrainIdUsedForProjection',
      payload: undefined,
    });
  });

  it('should throw when scenarioId is missing from route params', () => {
    mocks.useParams.mockReturnValue({ scenarioId: undefined });
    mocks.useGetScenario.mockReturnValue({
      data: undefined,
      isError: false,
      error: undefined,
    });

    expect(() => renderHook(() => useScenario())).toThrow('Missing scenarioId');
  });

  it('should throw when the scenario API call returns an error', () => {
    const apiError = new Error('Network error');
    mocks.useGetScenario.mockReturnValue({
      data: undefined,
      isError: true,
      error: apiError,
    });

    expect(() => renderHook(() => useScenario())).toThrow('Network error');
  });
});
