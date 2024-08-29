import React, { createContext, useContext, useMemo } from 'react';

import { useSelector } from 'react-redux';

import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { MODES } from 'main/consts';
import type { OsrdSlice } from 'reducers';
import type { EditorSelectors } from 'reducers/editor/selectors';
import type { MapViewerSelectors } from 'reducers/mapViewer/selectors';
import type { ConfSelectors, ConfSliceActions } from 'reducers/osrdconf/osrdConfCommon';
import { stdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import stdcmConfSelectors from 'reducers/osrdconf/stdcmConf/selectors';
import type { ValueOf } from 'utils/types';

export type OsrdSelectors = ConfSelectors | MapViewerSelectors | EditorSelectors;

export type OsrdContext = {
  slice: OsrdSlice;
  selectors: OsrdSelectors;
  mode: ValueOf<typeof MODES>;
  isStdcm: boolean;
  isSimulation: boolean;
} | null;

export const osrdContext = createContext<OsrdContext>(null);

export const useOsrdContext = () => {
  const context = useContext(osrdContext);
  if (!context) {
    throw new Error('useOsrdContext must be used within a OsrdContext.Provider');
  }
  return context;
};

export const useOsrdActions = () => {
  const { slice } = useOsrdContext();
  if (!slice) {
    throw new Error('OsrdContext slice is not available');
  }

  if (!slice.actions) {
    throw new Error('OsrdContext slice does not have any actions');
  }

  return slice.actions;
};

export const useOsrdConfActions = () => {
  const { slice } = useOsrdContext();

  if (!slice) {
    throw new Error('OsrdContext slice is not available');
  }

  if (!slice.actions) {
    throw new Error('OsrdContext slice does not have any actions');
  }

  return slice.actions as ConfSliceActions;
};

export const useOsrdConfSelectors = () => {
  const { selectors } = useOsrdContext();
  if (!selectors) {
    throw new Error('OsrdContext selectors are not available');
  }

  return selectors as ConfSelectors;
};

export const useInfraID = () => {
  const { selectors } = useOsrdContext();
  if (!selectors) {
    throw new Error('OsrdContext selectors are not available');
  }

  const infraId = useSelector(selectors.getInfraID);
  return infraId;
};

export const useInfraActions = () => {
  const { slice } = useOsrdContext();
  if (!slice) {
    throw new Error('OsrdContext slice is not available');
  }

  if (!slice.actions) {
    throw new Error('OsrdContext slice does not have any actions');
  }

  return {
    updateInfraID: slice.actions.updateInfraID,
    updateInfra: slice.actions.updateInfra,
  };
};

type OsrdContextLayoutProps = {
  slice: NonNullable<OsrdContext>['slice'];
  selectors: NonNullable<OsrdContext>['selectors'];
  mode: ValueOf<typeof MODES>;
};

export const OsrdContextLayout = ({ slice, selectors, mode }: OsrdContextLayoutProps) => {
  const value = useMemo(
    () => ({
      slice,
      selectors,
      mode,
      isStdcm: mode === MODES.stdcm,
      isSimulation: mode === MODES.simulation,
    }),
    [slice, selectors]
  );
  return (
    <osrdContext.Provider value={value}>
      <ModalProvider />
    </osrdContext.Provider>
  );
};

export const StdcmTestLayout = ({ children }: { children: React.ReactNode }) => {
  const value = useMemo(
    () => ({
      isSimulation: false,
      isStdcm: true,
      mode: MODES.stdcm,
      slice: stdcmConfSlice,
      selectors: stdcmConfSelectors,
    }),
    []
  );
  return <osrdContext.Provider value={value}>{children}</osrdContext.Provider>;
};
