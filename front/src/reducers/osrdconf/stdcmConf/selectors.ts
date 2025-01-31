import type { RootState } from 'reducers';
import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';
import { stdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { makeSubSelector } from 'utils/selectors';

const buildStdcmConfSelectors = () => {
  const commonConfSelectors = buildCommonConfSelectors(stdcmConfSlice);

  const getStdcmConf = (state: RootState) => state[stdcmConfSlice.name];
  const makeOsrdConfSelector = makeSubSelector<OsrdStdcmConfState>(getStdcmConf);

  const getStdcmPathSteps = makeOsrdConfSelector('stdcmPathSteps');
  const getStdcmSimulations = makeOsrdConfSelector('simulations');

  return {
    ...commonConfSelectors,
    getStdcmConf,

    getMargins: makeOsrdConfSelector('margins'),
    getTotalMass: makeOsrdConfSelector('totalMass'),
    getTotalLength: makeOsrdConfSelector('totalLength'),
    getMaxSpeed: makeOsrdConfSelector('maxSpeed'),
    getTowedRollingStockID: makeOsrdConfSelector('towedRollingStockID'),

    getStdcmPathSteps,
    getStdcmOrigin: (state: RootState) => {
      const pathSteps = getStdcmPathSteps(state);
      const origin = pathSteps.at(0);
      if (origin!.isVia) {
        throw new Error('Origin is a via point');
      }
      return origin!;
    },
    getStdcmDestination: (state: RootState) => {
      const pathSteps = getStdcmPathSteps(state);
      const destination = pathSteps.at(-1);
      if (destination!.isVia) {
        throw new Error('Destination is a via point');
      }
      return destination!;
    },
    getLinkedTrains: makeOsrdConfSelector('linkedTrains'),

    getStdcmSimulations,
  };
};

const selectors = buildStdcmConfSelectors();

export const { getStdcmConf, getMargins, getStdcmSimulations } = selectors;

export type StdcmConfSelectors = typeof selectors;

export default selectors;
