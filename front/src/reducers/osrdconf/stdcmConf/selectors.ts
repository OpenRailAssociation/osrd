import type { RootState } from 'reducers';
import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';
import { stdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { makeSubSelector } from 'utils/selectors';

const buildStdcmConfSelectors = () => {
  const commonConfSelectors = buildCommonConfSelectors<OsrdStdcmConfState>(stdcmConfSlice);
  const makeOsrdConfSelector = makeSubSelector<OsrdStdcmConfState>(commonConfSelectors.getConf);

  const getStdcmPathSteps = makeOsrdConfSelector('stdcmPathSteps');

  return {
    ...commonConfSelectors,
    getStandardStdcmAllowance: makeOsrdConfSelector('standardStdcmAllowance'),
    getTotalMass: makeOsrdConfSelector('totalMass'),
    getTotalLength: makeOsrdConfSelector('totalLength'),
    getMaxSpeed: makeOsrdConfSelector('maxSpeed'),
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
  };
};

const selectors = buildStdcmConfSelectors();

export type StdcmConfSelectors = typeof selectors;

export default selectors;
