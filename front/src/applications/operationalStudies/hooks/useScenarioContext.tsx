import { createContext, useContext, useMemo, type ReactNode } from 'react';

import useCachedTrackSections from 'applications/operationalStudies/hooks/useCachedTrackSections';
import {
  osrdEditoastApi,
  type Infra,
  type ScenarioResponse,
  type TrackSection,
  type WorkerStatus,
} from 'common/api/osrdEditoastApi';
import useWorkerStatus from 'modules/pathfinding/hooks/useWorkerStatus';

type ScenarioContextType = {
  infra?: Infra;
  infraId: number;
  workerStatus: WorkerStatus;
  isInfraLoaded: boolean;
  scenario: ScenarioResponse;
  /** Undefined when the scenario has no timetable yet */
  timetableId?: number;
  /** Undefined when the scenario has no timetable yet (the sandbox is linked to a timetable) */
  sandboxId?: number;
  electricalProfileSetId?: number;
  trackSectionsLoading: boolean;
  getTrackSectionsByIds: (requestedTrackIds: string[]) => Promise<Record<string, TrackSection>>;
} | null;
const ScenarioContext = createContext<ScenarioContextType>(null);

type ScenarioContextProviderProps = {
  scenario: ScenarioResponse;
  sandboxId?: number;
  children: ReactNode;
};

export const ScenarioContextProvider = ({
  scenario,
  sandboxId,
  children,
}: ScenarioContextProviderProps) => {
  const { data: infra } = osrdEditoastApi.endpoints.getInfraByInfraId.useQuery({
    infraId: scenario.infra_id,
  });

  const workerStatus = useWorkerStatus({ infraId: scenario.infra_id });

  const { getTrackSectionsByIds, isLoading: trackSectionsLoading } = useCachedTrackSections(
    scenario.infra_id
  );

  const providedContext = useMemo(
    () => ({
      infraId: scenario.infra_id,
      infra,
      workerStatus,
      isInfraLoaded: workerStatus === 'READY',
      scenario,
      // TODO(#18904): use the selected timetable instead of the first one
      timetableId: scenario.timetable_summaries.at(0)?.id,
      sandboxId,
      electricalProfileSetId: scenario.electrical_profile_set_id,
      trackSectionsLoading,
      getTrackSectionsByIds,
    }),
    [infra, scenario, workerStatus, sandboxId, trackSectionsLoading, getTrackSectionsByIds]
  );

  return <ScenarioContext.Provider value={providedContext}>{children}</ScenarioContext.Provider>;
};

/**
 * Scenario context that can be used even when the scenario has no timetable yet.
 */
export const useScenarioContextWithOptionalTimetable = () => {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error(
      'useScenarioContextWithOptionalTimetable must be used within a ScenarioContextProvider'
    );
  }
  return context;
};

/**
 * Scenario context for everything that needs a timetable.
 */
export const useScenarioContext = () => {
  const context = useScenarioContextWithOptionalTimetable();
  const { timetableId, sandboxId } = context;
  if (timetableId === undefined || sandboxId === undefined) {
    throw new Error('useScenarioContext must be used in a scenario with a timetable');
  }
  return { ...context, timetableId, sandboxId };
};
