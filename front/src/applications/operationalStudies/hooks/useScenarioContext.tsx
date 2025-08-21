import { createContext, useContext, useMemo, type ReactNode } from 'react';

import useCachedTrackSections from 'applications/operationalStudies/hooks/useCachedTrackSections';
import type { InfraWithState, TrackSection } from 'common/api/osrdEditoastApi';

type ScenarioContextType = {
  infraId: number;
  infra: InfraWithState;
  isInfraLoaded: boolean;
  getTrackSectionsByIds: (requestedTrackIds: string[]) => Promise<Record<string, TrackSection>>;
  trackSectionsLoading: boolean;
} | null;
const ScenarioContext = createContext<ScenarioContextType>(null);

type ScenarioContextProviderProps = {
  infra: InfraWithState;
  children: ReactNode;
};

export const ScenarioContextProvider = ({ infra, children }: ScenarioContextProviderProps) => {
  const { getTrackSectionsByIds, isLoading: trackSectionsLoading } = useCachedTrackSections(
    infra.id
  );

  const providedContext = useMemo(() => {
    const isInfraLoaded = ['ERROR', 'TRANSIENT_ERROR', 'CACHED'].includes(infra.state);
    return {
      getTrackSectionsByIds,
      infraId: infra.id,
      infra,
      isInfraLoaded,
      trackSectionsLoading,
    };
  }, [getTrackSectionsByIds, infra, trackSectionsLoading]);
  return <ScenarioContext.Provider value={providedContext}>{children}</ScenarioContext.Provider>;
};

export const useScenarioContext = () => {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error('useScenarioContext must be used within a ScenarioContextProvider');
  }
  return context;
};
