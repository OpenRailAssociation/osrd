import { createContext, useContext, useMemo, type ReactNode } from 'react';

import useCachedTrackSections from 'applications/operationalStudies/hooks/useCachedTrackSections';
import type { TrackSection } from 'common/api/osrdEditoastApi';
import type { InfraWithStatus } from 'modules/infra/types';

type ScenarioContextType = {
  infraId: number;
  infra: InfraWithStatus;
  isInfraLoaded: boolean;
  getTrackSectionsByIds: (requestedTrackIds: string[]) => Promise<Record<string, TrackSection>>;
  trackSectionsLoading: boolean;
} | null;
const ScenarioContext = createContext<ScenarioContextType>(null);

type ScenarioContextProviderProps = {
  infra: InfraWithStatus;
  children: ReactNode;
};

export const ScenarioContextProvider = ({ infra, children }: ScenarioContextProviderProps) => {
  const { getTrackSectionsByIds, isLoading: trackSectionsLoading } = useCachedTrackSections(
    infra.id
  );

  const providedContext = useMemo(
    () => ({
      getTrackSectionsByIds,
      infraId: infra.id,
      infra,
      isInfraLoaded: infra.status === 'READY',
      trackSectionsLoading,
    }),
    [getTrackSectionsByIds, infra, trackSectionsLoading]
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
