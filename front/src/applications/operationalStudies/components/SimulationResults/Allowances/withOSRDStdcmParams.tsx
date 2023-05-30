import { noop } from 'lodash';
import React, { ComponentType, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  updateGridMarginBefore,
  updateGridMarginAfter,
  updateStdcmStandardAllowance,
} from 'reducers/osrdconf';
import {
  getGridMarginBefore,
  getGridMarginAfter,
  getStandardStdcmAllowance,
} from 'reducers/osrdconf/selectors';
import SingleAllowance from './StandardAllowanceDefault';

import { ALLOWANCE_UNITS_KEYS } from './allowancesConsts';
import { StandardAllowance } from 'applications/operationalStudies/consts';

function withOSRDStdcmParams<T>(Component: ComponentType<T>) {
  return (hocProps: T) => {
    const { t } = useTranslation(['allowances']);
    const dispatch = useDispatch();
    const gridMarginBefore = useSelector(getGridMarginBefore);
    const gridMarginAfter = useSelector(getGridMarginAfter);
    const stdcmStandardAllowance = useSelector(getStandardStdcmAllowance);

    const allowanceTypes = [
      {
        id: 'time',
        label: t('allowanceTypes.time'),
        unit: ALLOWANCE_UNITS_KEYS.time,
      },
    ];

    const standardAllowanceTypes = [
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

    const [trainDetail] = useState({ allowances: [] });

    // @TODO implement this behaviour or refacto
    // Alowance mutation in REST strat
    const mutateSingleAllowances = () => {
      /* empty */
    };

    const changeType = (type: StandardAllowance, typeKey: string) => {
      if (typeKey === 'gridMarginBefore') {
        dispatch(updateGridMarginBefore(type.value || 0));
      } else if (typeKey === 'gridMarginAfter') {
        dispatch(updateGridMarginAfter(type.value || 0));
      } else if (typeKey === 'standardStdcmAllowance') {
        dispatch(updateStdcmStandardAllowance(type));
      }
    };

    const getAllowanceTypes = (typeKey: string) => {
      if (typeKey === 'standardStdcmAllowance') {
        return standardAllowanceTypes;
      }
      return allowanceTypes;
    };

    const getBaseValue = (typeKey: string) => {
      if (typeKey === 'gridMarginBefore') {
        return { type: 'time', value: gridMarginBefore };
      }
      if (typeKey === 'gridMarginAfter') {
        return { type: 'time', value: gridMarginAfter };
      }
      if (typeKey === 'standardStdcmAllowance') {
        return stdcmStandardAllowance || { type: 'time', value: 0 };
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
        getAllowanceTypes={getAllowanceTypes}
        distributionsTypes={distributionsTypes}
        getAllowances={noop}
        changeType={changeType}
        getBaseValue={getBaseValue}
        options={{ immediateMutation: true, setDistribution: false }}
      />
    );
  };
}

export default withOSRDStdcmParams(SingleAllowance);
