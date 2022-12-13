import { ComponentType, useCallback, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get, patch } from 'common/requests';
import { updateGridMarginBefore, updateGridMarginAfter } from 'reducers/osrdconf';
import SingleAllowance from './StandardAllowanceDefault';

import { ALLOWANCE_UNITS_KEYS } from './consts';

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

    // Alowance mutation in REST strat
    const mutateSingleAllowances = (newAllowances: any) => {
      console.log('mutateSingleAllowances', newAllowances);
    };

    const changeType = (type: any, typeKey: string) => {
      if (typeKey === 'gridMarginBefore') {
        dispatch(updateGridMarginBefore(type.value));
      } else if (typeKey === 'gridMarginAfter') {
        dispatch(updateGridMarginAfter(type.value));
      }
    };

    return (
      <Component
        {...(hocProps as T)}
        t={t}
        dispatch={dispatch}
        mutateSingleAllowances={mutateSingleAllowances}
        trainDetail={trainDetail}
        allowanceTypes={allowanceTypes}
        distributionsTypes={distributionsTypes}
        getAllowances={() => {}}
        setIsUpdating={setSyncInProgress}
        changeType={changeType}
        options={{ immediateMutation: true, setDistribution: false }}
      />
    );
  };
}

export default withOSRDStdcmParams(SingleAllowance);
