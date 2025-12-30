import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { MapSettings } from 'reducers/commonMap/types';

type MapContextType =
  | ({
      infraId?: number;
    } & MapSettings)
  | null;
const MapContext = createContext<MapContextType>(null);

type MapContextProviderProps = {
  infraId?: number;
  mapSettings: MapSettings;
  updateMapSettings: (modifs: Partial<MapSettings>) => void;
  children: ReactNode;
};

export const MapContextProvider = ({
  infraId,
  mapSettings,
  updateMapSettings,
  children,
}: MapContextProviderProps) => {
  const providedContext = useMemo(
    () => ({
      infraId,
      ...mapSettings,
      updateMapSettings,
    }),
    [infraId, mapSettings, updateMapSettings]
  );

  return <MapContext.Provider value={providedContext}>{children}</MapContext.Provider>;
};

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapContextProvider');
  }
  return context;
};
