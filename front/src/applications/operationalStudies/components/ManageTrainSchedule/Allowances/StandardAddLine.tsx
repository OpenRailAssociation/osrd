import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { FaPlus, FaSearch } from 'react-icons/fa';
import { unitsList } from './consts';

export default function StandardAddLine({ pathLength }: { pathLength: number }) {
  const { t } = useTranslation('operationalStudies/allowances');
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(pathLength);
  const [addEngineeringValue, setAddEngineeringValue] = useState<InputGroupSNCFValue>();
  return (
    <div className="allowances-engineering-add-line">
      <div>
        <InputSNCF
          id="allowances-standard-from"
          type="number"
          label={<small className="text-nowrap">{t('addLine.from')}</small>}
          unit="m"
          sm
          noMargin
          min={0}
          isInvalid={from >= to || (!from && from !== 0)}
          value={from}
          onChange={(e) => setFrom(+e.target.value)}
          appendOptions={{ label: <FaSearch />, name: 'op-from', onClick: () => {} }}
        />
      </div>
      <div>
        <InputSNCF
          id="allowances-standard-to"
          type="number"
          label={<small className="text-nowrap">{t('addLine.to')}</small>}
          unit="m"
          sm
          noMargin
          min={0}
          isInvalid={from >= to || (!to && to !== 0)}
          value={to}
          onChange={(e) => setTo(+e.target.value)}
          appendOptions={{ label: <FaSearch />, name: 'op-to', onClick: () => {} }}
        />
      </div>
      <div>
        <div className="allowances-range-length-label small text-nowrap">{t('addLine.length')}</div>
        <div className="allowances-range-length">{to - from}m</div>
      </div>
      <div>
        <InputGroupSNCF
          id="allowances-standard-value"
          label={<small className="text-nowrap">{t('addLine.value')}</small>}
          orientation="right"
          sm
          condensed
          value={addEngineeringValue?.value}
          handleType={setAddEngineeringValue}
          options={unitsList}
        />
      </div>
      <button className="btn btn-sm btn-success" type="button">
        <FaPlus />
      </button>
    </div>
  );
}
