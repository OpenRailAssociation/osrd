import { createContext, useContext, useMemo, type ReactNode } from 'react';

import useCachedTrackSections from 'applications/operationalStudies/hooks/useCachedTrackSections';
import type { ScenarioResponse, TrackSection } from 'common/api/osrdEditoastApi';
import type { InfraWithStatus } from 'modules/infra/types';

type ScenarioContextType = {
  infra: InfraWithStatus;
  infraId: number;
  isInfraLoaded: boolean;
  scenario: ScenarioResponse;
  timetableId: number;
  trackSectionsLoading: boolean;
  getTrackSectionsByIds: (requestedTrackIds: string[]) => Promise<Record<string, TrackSection>>;
} | null;
const ScenarioContext = createContext<ScenarioContextType>(null);

type ScenarioContextProviderProps = {
  infra: InfraWithStatus;
  scenario: ScenarioResponse;
  children: ReactNode;
};

export const ScenarioContextProvider = ({
  infra,
  scenario,
  children,
}: ScenarioContextProviderProps) => {
  const { getTrackSectionsByIds, isLoading: trackSectionsLoading } = useCachedTrackSections(
    infra.id
  );
  const providedContext = useMemo(
    () => ({
      infraId: infra.id,
      infra,
      isInfraLoaded: infra.status === 'READY',
      scenario,
      timetableId: scenario.timetable_id,
      trackSectionsLoading,
      getTrackSectionsByIds,
    }),
    [infra, scenario, trackSectionsLoading, getTrackSectionsByIds]
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
