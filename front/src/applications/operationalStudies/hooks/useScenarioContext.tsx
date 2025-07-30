import { createContext, useContext, useMemo, type ReactNode } from 'react';

import useCachedTrackSections from 'applications/operationalStudies/hooks/useCachedTrackSections';
import type { ScenarioResponse, TrackSection } from 'common/api/osrdEditoastApi';
import type { InfraWithStatus } from 'modules/infra/types';

type ScenarioContextType = {
  infraId: number;
  infra: InfraWithStatus;
  isInfraLoaded: boolean;
  getTrackSectionsByIds: (requestedTrackIds: string[]) => Promise<Record<string, TrackSection>>;
  scenario: ScenarioResponse;
  trackSectionsLoading: boolean;
} | null;
const ScenarioContext = createContext<ScenarioContextType>(null);

type ScenarioContextProviderProps = {
  infra: InfraWithStatus;
  infraId: number;
  children: ReactNode;
  scenario: ScenarioResponse;
};

export const ScenarioContextProvider = ({
  infra,
  infraId,
  scenario,
  children,
}: ScenarioContextProviderProps) => {
  const { getTrackSectionsByIds, isLoading: trackSectionsLoading } =
    useCachedTrackSections(infraId);
  const providedContext = useMemo(
    () => ({
      getTrackSectionsByIds,
      infraId,
      infra,
      isInfraLoaded: infra.status === 'READY',
      trackSectionsLoading,
      scenario,
    }),
    [getTrackSectionsByIds, infra, trackSectionsLoading, infraId, scenario]
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
