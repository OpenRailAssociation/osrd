import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { FaPlus, FaSearch } from 'react-icons/fa';
import { CgArrowsShrinkH } from 'react-icons/cg';
import { BiArrowFromLeft, BiArrowFromRight } from 'react-icons/bi';
import { Allowance } from 'common/api/osrdEditoastApi';
import { unitsList } from './consts';

type Props = {
  addAllowance: (allowance: Allowance) => void;
  pathLength: number;
  type: 'engineering' | 'standard';
};

export default function AddLine({ addAllowance, pathLength, type }: Props) {
  const { t } = useTranslation('operationalStudies/allowances');
  const distributionsList = [
    { label: t('distribution.linear'), value: 'LINEAR' },
    { label: t('distribution.mareco'), value: 'MARECO' },
  ];
  const [beginPosition, setBeginPosition] = useState(0);
  const [endPosition, setEndPosition] = useState(pathLength);
  const [margeLength, setMargeLength] = useState(endPosition - beginPosition);
  const [distribution, setDistribution] = useState(distributionsList[0].value);
  const [valueAndUnit, setValueAndUnit] = useState<InputGroupSNCFValue>();

  const handleInputFrom = (value: number) => {
    setBeginPosition(value);
    setMargeLength(endPosition - value);
  };

  const handleInputTo = (value: number) => {
    setEndPosition(value);
    setMargeLength(value - beginPosition);
  };

  const handleInputLength = (value: number) => {
    setMargeLength(value);
    setEndPosition(beginPosition + value);
  };

  const handleAddAllowance = () => {
    addAllowance({
      allowance_type: type,
      distribution,
      capacity_speed_limit: 0,
      begin_position: beginPosition,
      end_position: endPosition,
      value: {
        value_type: 'time_per_distance',
        minutes: 5,
      },
    } as Allowance);
  };

  return (
    <div className="allowances-add-line">
      <div className="first-line">
        <div>
          <InputSNCF
            id={`allowances-${type}-begin-position`}
            type="number"
            label={
              <>
                <BiArrowFromLeft />
                <small className="text-nowrap">{t('addLine.beginPosition')}</small>
              </>
            }
            unit="m"
            sm
            noMargin
            min={0}
            isInvalid={beginPosition >= endPosition || (!beginPosition && beginPosition !== 0)}
            value={beginPosition}
            onChange={(e) => handleInputFrom(+e.target.value)}
            appendOptions={{ label: <FaSearch />, name: 'op-begin-position', onClick: () => {} }}
          />
        </div>
        <div>
          <InputSNCF
            id={`allowances-${type}-end-position`}
            type="number"
            label={
              <>
                <BiArrowFromRight />
                <small className="text-nowrap">{t('addLine.endPosition')}</small>
              </>
            }
            unit="m"
            sm
            noMargin
            min={0}
            isInvalid={beginPosition >= endPosition || (!endPosition && endPosition !== 0)}
            value={endPosition}
            onChange={(e) => handleInputTo(+e.target.value)}
            appendOptions={{ label: <FaSearch />, name: 'op-end-position', onClick: () => {} }}
          />
        </div>
        <div>
          <InputSNCF
            id={`allowances-${type}-length`}
            type="number"
            label={
              <>
                <CgArrowsShrinkH />
                <small className="text-nowrap">{t('addLine.length')}</small>
              </>
            }
            unit="m"
            sm
            noMargin
            min={1}
            isInvalid={margeLength < 1}
            value={margeLength}
            onChange={(e) => handleInputLength(+e.target.value)}
          />
        </div>
      </div>
      <div className="second-line">
        {type === 'engineering' && (
          <div>
            <OptionsSNCF
              name="allowances-engineering-distribution-switch"
              onChange={(e) => setDistribution(e.target.value)}
              selectedValue={distribution}
              options={distributionsList}
            />
          </div>
        )}
        <div className="allowances-value">
          <InputGroupSNCF
            id={`allowances-${type}-value`}
            orientation="right"
            sm
            condensed
            value={valueAndUnit?.value}
            handleType={setValueAndUnit}
            options={unitsList}
          />
        </div>
        <button className="btn btn-sm btn-success" type="button" onClick={handleAddAllowance}>
          <FaPlus />
        </button>
      </div>
    </div>
  );
}
