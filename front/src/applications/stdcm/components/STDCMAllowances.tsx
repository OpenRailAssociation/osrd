import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useTranslation } from 'react-i18next';

import StdcmSingleAllowance from 'applications/stdcm/components/OldAllowances/withOSRDStdcmParams';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';

import {
  getGridMarginBefore,
  getGridMarginAfter,
  getStandardStdcmAllowance,
} from 'reducers/osrdconf/selectors';
import {
  updateGridMarginAfter,
  updateGridMarginBefore,
  updateStdcmStandardAllowance,
} from 'reducers/osrdconf';
import { StandardAllowance } from 'applications/operationalStudies/consts';
import { AllowanceValue } from 'common/api/osrdEditoastApi';
import { ALLOWANCE_UNITS_KEYS } from './OldAllowances/allowancesConsts';

// const STDCMAllowances = () => {
//   const { t } = useTranslation('allowances');

//   return (
//     <div className="osrd-config-item mb-2 osrd-config-item-container">
//       <div className="row">
//         <div className="col-6">
//           <div>{t('allowances:gridMarginBeforeAfter')}</div>
//           <div className="row">
//             <div className="col-6">
//               <StdcmSingleAllowance typeKey="gridMarginBefore" isCondensed />
//             </div>
//             <div className="col-6">
//               <StdcmSingleAllowance typeKey="gridMarginAfter" isCondensed />
//             </div>
//           </div>
//         </div>
//         <div className="col-6">
//           <div>{t('allowances:standardAllowance')}</div>
//           <StdcmSingleAllowance typeKey="standardStdcmAllowance" isCondensed />
//         </div>
//       </div>
//     </div>
//   );
// };

const STDCMAllowances = () => {
  const { t } = useTranslation('allowances');
  const dispatch = useDispatch();
  const gridMarginBefore = useSelector(getGridMarginBefore);
  const gridMarginAfter = useSelector(getGridMarginAfter);
  const stdcmStandardAllowance = useSelector(getStandardStdcmAllowance);
  const standardAllowanceTypes = [
    {
      id: 'percentage',
      label: t ? t('allowanceTypes.percentage') : '',
      unit: ALLOWANCE_UNITS_KEYS.percentage,
    },
    {
      id: 'time_per_distance',
      label: t ? t('allowanceTypes.time_per_distance') : '',
      unit: ALLOWANCE_UNITS_KEYS.time_per_distance,
    },
  ];

  const onchangeType = (newTypeValue: InputGroupSNCFValue) => {
    if (newTypeValue.type == null) return;
    const processedType: StandardAllowance = {
      type: newTypeValue.type as AllowanceValue['value_type'],
      value:
        newTypeValue.value === '' || newTypeValue.value === undefined ? 0 : +newTypeValue.value,
    };

    dispatch(updateStdcmStandardAllowance(processedType));
  };

  return (
    <div className="row osrd-config-item mb-2 osrd-config-item-container">
      <div className="col-6">
        <label htmlFor="gridMarginBeforeAfter">{t('allowances:gridMarginBeforeAfter')}</label>
        <div id="gridMarginBeforeAfter" className="row">
          <div className="col-6">
            <InputSNCF
              id="standardAllowanceTypeGridMarginBefore"
              type="text"
              value={gridMarginBefore}
              unit={ALLOWANCE_UNITS_KEYS.time}
              condensed
              onChange={(e) => dispatch(updateGridMarginBefore(+e.target.value || 0))}
              sm
              noMargin
            />
          </div>
          <div className="col-6">
            <InputSNCF
              id="standardAllowanceTypeGridMarginAfter"
              type="text"
              value={gridMarginAfter}
              unit={ALLOWANCE_UNITS_KEYS.time}
              condensed
              onChange={(e) => dispatch(updateGridMarginAfter(+e.target.value || 0))}
              sm
              noMargin
            />
          </div>
        </div>
      </div>
      <div className="col-6">
        <label htmlFor="standardAllowanceTypeSelect">{t('allowances:standardAllowance')}</label>
        <InputGroupSNCF
          id="standardAllowanceTypeSelect"
          options={standardAllowanceTypes}
          handleType={onchangeType}
          value={stdcmStandardAllowance?.value || 0}
          type={stdcmStandardAllowance?.type || ''}
          condensed
          sm
        />
      </div>
    </div>
  );
};

export default STDCMAllowances;
