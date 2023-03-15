import React, { ComponentType, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get, patch } from 'common/requests';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation/actions';

import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { setFailure, setSuccess } from 'reducers/main';
import Allowances from './Allowances';

import { ALLOWANCE_UNITS_KEYS } from './allowancesConsts';

// Initialy try to implement https://react-typescript-cheatsheet.netlify.app/docs/hoc/, no success

function withOSRDData<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['allowances']);
    const dispatch = useDispatch();
    const simulation = useSelector((state: any) => state.osrdsimulation.simulation.present);
    const allowancesSettings = useSelector((state: any) => state.osrdsimulation.allowancesSettings);
    const selectedProjection = useSelector((state: any) => state.osrdsimulation.selectedProjection);
    const selectedTrain = useSelector((state: any) => state.osrdsimulation.selectedTrain);

    const [, setSyncInProgress] = useState(false);
    const [trainDetail, setTrainDetail] = useState<any>({ allowances: [] });

    const getAllowances = async () => {
      try {
        setSyncInProgress(true);
        const result = await get(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/`);
        setTrainDetail(result);
        setSyncInProgress(false);
      } catch (e: unknown) {
        dispatch(
          setFailure({
            name: (e as Error).name,
            message: (e as Error).message,
          })
        );
      }
    };

    const allowanceTypes = [
      {
        id: 'time',
        label: t('allowanceTypes.time'),
        unit: ALLOWANCE_UNITS_KEYS.time,
      },
      {
        id: 'percentage',
        label: t('allowanceTypes.percentage'),
        unit: ALLOWANCE_UNITS_KEYS.percentage,
      },
      {
        id: 'time_per_distance',
        label: t('allowanceTypes.time_per_distance'),
        unit: ALLOWANCE_UNITS_KEYS.time_per_distance,
      },
    ];

    const getAllowanceTypes = () => allowanceTypes;

    // Alowance mutation in REST strat
    const mutateAllowances = async (newAllowances: any) => {
      try {
        setSyncInProgress(true);
        await patch(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/`, {
          ...trainDetail,
          allowances: newAllowances,
        });
        const newSimulationTrains = Array.from(simulation.trains);
        newSimulationTrains[selectedTrain] = await get(
          `${trainscheduleURI}${simulation.trains[selectedTrain].id}/result/`,
          {
            params: {
              id: simulation.trains[selectedTrain].id,
              path: selectedProjection.path,
            },
          }
        );

        getAllowances();
        dispatch(updateSimulation({ ...simulation, trains: newSimulationTrains }));
        dispatch(updateMustRedraw(true));
        dispatch(
          setSuccess({
            title: t('allowanceModified.anyAllowanceModified'),
            text: '',
          })
        );
        setSyncInProgress(false);
      } catch (e: unknown) {
        setSyncInProgress(false);
        dispatch(
          setFailure({
            name: (e as Error).name,
            message: t('allowanceModified.anyAllowanceModificationError'),
          })
        );
      }
    };

    useEffect(() => {
      getAllowances();
    }, [selectedTrain]);

    return (
      <Component
        {...(hocProps as T)}
        t={t}
        dispatch={dispatch}
        mutateAllowances={mutateAllowances}
        getAllowances={getAllowances}
        simulation={simulation}
        allowanceSettings={allowancesSettings}
        selectedProjection={selectedProjection}
        selectedTrain={selectedTrain} // To be removed
        trainDetail={trainDetail}
        persistentAllowances={trainDetail.allowances}
        getAllowanceTypes={getAllowanceTypes}
      />
    );
  };
}

export default withOSRDData(Allowances);
