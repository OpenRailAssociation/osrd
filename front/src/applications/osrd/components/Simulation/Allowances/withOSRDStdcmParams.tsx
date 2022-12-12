import { ComponentType, useCallback, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get, patch } from 'common/requests';
import {
  updateMustRedraw,
  updateSimulation,
  updateSpeedSpaceSettings,
} from 'reducers/osrdsimulation/actions';
import SingleAllowance from './StandardAllowanceDefault';
import { AnyAction } from 'redux';

import { trainscheduleURI } from 'applications/osrd/components/Simulation/consts';
import { setFailure, setSuccess } from 'reducers/main';

import { TYPES_UNITS, ALLOWANCE_UNITS_KEYS } from './consts';

// Initialy try to implement https://react-typescript-cheatsheet.netlify.app/docs/hoc/, no success

function withOSRDStdcmParams<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['allowances']);
    const dispatch = useDispatch();
    const simulation = useSelector((state: any) => state.osrdsimulation.simulation.present);
    const allowancesSettings = useSelector((state: any) => state.osrdsimulation.allowancesSettings);
    const selectedProjection = useSelector((state: any) => state.osrdsimulation.selectedProjection);
    const selectedTrain = useSelector((state: any) => state.osrdsimulation.selectedTrain);

    const allowanceTypes = [
      {
        id: 'time',
        label: t('allowanceTypes.time'),
        unit: ALLOWANCE_UNITS_KEYS.time,
      },
    ];

    // Do not change the keys (id, label) without checking implications
    const distributionsTypes = [
      {
        id: 'LINEAR',
        label: t('distributions.linear'),
      },
      {
        id: 'MARECO',
        label: t('distributions.mareco'),
      },
    ];

    const [syncInProgress, setSyncInProgress] = useState(false);
    const [trainDetail, setTrainDetail] = useState<any>({ allowances: [] });

    const getAllowances = async () => {
      try {
        setSyncInProgress(true);
        const result = await get(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/`);
        setTrainDetail(result);
        setSyncInProgress(false);
        //setAllowances(result.allowances);
        //setIsUpdating(false);
      } catch (e: any) {
        console.log('ERROR', e);
        dispatch(
          setFailure({
            name: e.name,
            message: e.message,
          })
        );
      }
    };

    // Alowance mutation in REST strat
    const mutateSingleAllowances = (newAllowances: any) => {
      console.log('mutateSingleAllowances', newAllowances);
    };

    return (
      <Component
        {...(hocProps as T)}
        t={t}
        dispatch={dispatch}
        mutateSingleAllowances={mutateSingleAllowances}
        //getAllowances={getAllowances}
        //simulation={simulation}
        //allowanceSettings={allowancesSettings}
        //selectedProjection={selectedProjection}
        //selectedTrain={selectedTrain} // To be removed
        trainDetail={trainDetail}
        allowanceTypes={allowanceTypes}
        distributionsTypes={distributionsTypes}
        getAllowances={() => {}}
        setIsUpdating={setSyncInProgress}
        config={{ immediateMutation: true, setDistribution: false }}
      />
    );
  };
}

export default withOSRDStdcmParams(SingleAllowance);
