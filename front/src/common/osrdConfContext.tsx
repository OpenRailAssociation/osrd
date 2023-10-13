import React, { createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { simulationConfSliceType } from 'reducers/osrdconf2/simulationConf';
import { stdcmConfSliceType } from 'reducers/osrdconf2/stdcmConf';

export type OsrdConfType = simulationConfSliceType | stdcmConfSliceType | null;
type Props = { osrdConfSlice: OsrdConfType };

const OsrdConfContext = createContext<OsrdConfType>(null);

export const useOsrdConfContext = () => {
  const context = useContext(OsrdConfContext);
  if (!context) {
    throw new Error('useOsrdConfContext must be used within a OsrdConfContext.Provider');
  }
  return context;
};

export const OsrdConfContextLayout = ({ osrdConfSlice }: Props) => (
  <OsrdConfContext.Provider value={osrdConfSlice}>
    <Outlet />
  </OsrdConfContext.Provider>
);

export default OsrdConfContext;
