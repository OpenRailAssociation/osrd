import React, { ComponentType, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateGridMarginBefore, updateGridMarginAfter } from 'reducers/osrdconf';
import SingleAllowance from './StandardAllowanceDefault';

import { ALLOWANCE_UNITS_KEYS } from './consts';

function withOSRDStdcmParams<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['allowances']);
    const dispatch = useDispatch();
    const gridMarginBefore = useSelector((state: any) => state.osrdconf.gridMarginBefore);
    const gridMarginAfter = useSelector((state: any) => state.osrdconf.gridMarginAfter);

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

    const [trainDetail] = useState<any>({ allowances: [] });

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

    const getBaseValue = (typeKey: string) => {
      if (typeKey === 'gridMarginBefore') {
        return { type: 'time', value: gridMarginBefore };
      }
      if (typeKey === 'gridMarginAfter') {
        return { type: 'time', value: gridMarginAfter };
      }
      return { type: 'time', value: 0 };
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
        changeType={changeType}
        getBaseValue={getBaseValue}
        options={{ immediateMutation: true, setDistribution: false }}
      />
    );
  };
}

export default withOSRDStdcmParams(SingleAllowance);
