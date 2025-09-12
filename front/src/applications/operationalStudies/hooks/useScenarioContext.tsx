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
  timetableId: number;
  electricalProfileSetId?: number;
  trackSectionsLoading: boolean;
  getTrackSectionsByIds: (requestedTrackIds: string[]) => Promise<Record<string, TrackSection>>;
} | null;
const ScenarioContext = createContext<ScenarioContextType>(null);

type ScenarioContextProviderProps = {
  scenario: ScenarioResponse;
  children: ReactNode;
};

export const ScenarioContextProvider = ({ scenario, children }: ScenarioContextProviderProps) => {
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
      timetableId: scenario.timetable_id,
      electricalProfileSetId: scenario.electrical_profile_set_id,
      trackSectionsLoading,
      getTrackSectionsByIds,
    }),
    [infra, scenario, workerStatus, trackSectionsLoading, getTrackSectionsByIds]
  );

  return <ScenarioContext.Provider value={providedContext}>{children}</ScenarioContext.Provider>;
};

export const useScenarioContext = () => {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error('useScenarioContext must be used within a ScenarioContextProvider');
  }
  return context;
};
