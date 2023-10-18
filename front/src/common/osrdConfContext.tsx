import React, { createContext, useContext, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { simulationConfSliceType } from 'reducers/osrdconf2/simulationConf';
import { simulationConfSelectorsType } from 'reducers/osrdconf2/simulationConf/selectors';
import { stdcmConfSliceType } from 'reducers/osrdconf2/stdcmConf';
import { stdcmConfSelectorsType } from 'reducers/osrdconf2/stdcmConf/selectors';

export type OsrdConfType = {
  slice: simulationConfSliceType | stdcmConfSliceType;
  selectors: simulationConfSelectorsType | stdcmConfSelectorsType;
} | null;

const OsrdConfContext = createContext<OsrdConfType>(null);

export const useOsrdConfContext = () => {
  const context = useContext(OsrdConfContext);
  if (!context) {
    throw new Error('useOsrdConfContext must be used within a OsrdConfContext.Provider');
  }
  return context;
};

type Props = {
  slice: NonNullable<OsrdConfType>['slice'];
  selectors: NonNullable<OsrdConfType>['selectors'];
};
export const OsrdConfContextLayout = ({ slice, selectors }: Props) => {
  const value = useMemo(() => ({ slice, selectors }), [slice, selectors]);
  return (
    <OsrdConfContext.Provider value={value}>
      <Outlet />
    </OsrdConfContext.Provider>
  );
};

export default OsrdConfContext;
