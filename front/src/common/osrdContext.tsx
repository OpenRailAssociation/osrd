import React, { createContext, useContext, useMemo } from 'react';

import type { ObjectFieldsTypes } from 'utils/types';

import { MODES } from 'applications/operationalStudies/consts';

import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

import type { OsrdSlice } from 'reducers';
import type { EditorSelectors } from 'reducers/editor/selectors';
import type { MapViewerSelectors } from 'reducers/mapViewer/selectors';
import { useSelector } from 'react-redux';
import { ConfSelectors, ConfSliceActions } from 'reducers/osrdconf/osrdConfCommon';

export type OsrdSelectors = ConfSelectors | MapViewerSelectors | EditorSelectors;

export type OsrdContext = {
  slice: OsrdSlice;
  selectors: OsrdSelectors;
  mode: ObjectFieldsTypes<typeof MODES>;
  isStdcm: boolean;
  isSimulation: boolean;
} | null;

const osrdContext = createContext<OsrdContext>(null);

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

export const useUpdateInfraID = () => {
  const { slice } = useOsrdContext();
  if (!slice) {
    throw new Error('OsrdContext slice is not available');
  }

  if (!slice.actions) {
    throw new Error('OsrdContext slice does not have any actions');
  }

  return slice.actions.updateInfraID;
};

type OsrdContextLayoutProps = {
  slice: NonNullable<OsrdContext>['slice'];
  selectors: NonNullable<OsrdContext>['selectors'];
  mode: ObjectFieldsTypes<typeof MODES>;
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
