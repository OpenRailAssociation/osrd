import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { FaPencilAlt, FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import { CgArrowsShrinkH } from 'react-icons/cg';
import { BiArrowFromLeft, BiArrowFromRight } from 'react-icons/bi';
import { AllowanceValue, EngineeringAllowance, RangeAllowance } from 'common/api/osrdEditoastApi';
import { MdCancel } from 'react-icons/md';
import { unitsList, unitsNames } from './consts';
import { AllowancesTypes, SetAllowanceSelectedIndexType } from './types';
import getAllowanceValue from './Helpers';
import cx from 'classnames';

type Props = {
  allowances: RangeAllowance[] | EngineeringAllowance[];
  addAllowance: (allowance: RangeAllowance | EngineeringAllowance, type: AllowancesTypes) => void;
  pathLength: number;
  allowanceSelectedIndex?: number;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
  deleteAllowance: (allowanceIndex: number) => void;
  type: 'engineering' | 'standard';
};

export default function AllowancesActions({
  allowances,
  addAllowance,
  pathLength,
  allowanceSelectedIndex,
  setAllowanceSelectedIndex,
  deleteAllowance,
  type,
}: Props) {
  const { t } = useTranslation('operationalStudies/allowances');
  const distributionsList = [
    { label: t('distribution.linear'), value: 'LINEAR' },
    { label: t('distribution.mareco'), value: 'MARECO' },
  ];
  const [beginPosition, setBeginPosition] = useState(0);
  const [endPosition, setEndPosition] = useState(pathLength);
  const [allowanceLength, setAllowanceLength] = useState(endPosition - beginPosition);
  const [distribution, setDistribution] = useState(distributionsList[0].value);
  const [valueAndUnit, setValueAndUnit] = useState<AllowanceValue>();

  const handleInputFrom = (value: number) => {
    setBeginPosition(value);
    setAllowanceLength(endPosition - value);
  };

  const handleInputTo = (value: number) => {
    setEndPosition(value);
    setAllowanceLength(value - beginPosition);
  };

  const handleInputLength = (value: number) => {
    setAllowanceLength(value);
    setEndPosition(beginPosition + value);
  };

  const handleAddAllowance = () => {
    if (type === 'standard') {
      addAllowance(
        {
          begin_position: beginPosition,
          end_position: endPosition,
          value: valueAndUnit,
        } as RangeAllowance,
        AllowancesTypes.standard
      );
    }
    if (type === 'engineering') {
      addAllowance(
        {
          allowance_type: type,
          distribution,
          capacity_speed_limit: 0,
          begin_position: beginPosition,
          end_position: endPosition,
          value: valueAndUnit,
        } as EngineeringAllowance,
        AllowancesTypes.engineering
      );
    }
  };

  const handleTypePouet = (typePouet: InputGroupSNCFValue) => {
    if (typePouet.type && typePouet.value !== undefined) {
      setValueAndUnit({
        value_type: typePouet.type as AllowanceValue['value_type'],
        [unitsNames[typePouet.type as keyof typeof unitsNames]]: typePouet.value,
      } as AllowanceValue);
    }
  };

  function validityTest() {
    return beginPosition < endPosition && getAllowanceValue(valueAndUnit) > 0;
  }

  useEffect(() => {
    if (allowanceSelectedIndex !== undefined) {
      if (type === 'standard') {
        const selectedAllowance = allowances[allowanceSelectedIndex] as RangeAllowance;
        setBeginPosition(selectedAllowance.begin_position);
        setEndPosition(selectedAllowance.end_position);
        setAllowanceLength(selectedAllowance.end_position - selectedAllowance.begin_position);
      }
      if (type === 'engineering') {
        const selectedAllowance = allowances[allowanceSelectedIndex] as EngineeringAllowance;
        setBeginPosition(selectedAllowance.begin_position);
        setEndPosition(selectedAllowance.end_position);
        setAllowanceLength(selectedAllowance.end_position - selectedAllowance.begin_position);
        setDistribution(selectedAllowance.distribution);
      }
    }
  }, [allowanceSelectedIndex]);

  return (
    <div className="allowances-actions">
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
            isInvalid={allowanceLength < 1}
            value={allowanceLength}
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
            value={getAllowanceValue(valueAndUnit)}
            handleType={handleTypePouet}
            options={unitsList}
            typeValue="number"
            min={0}
            isInvalid={!(getAllowanceValue(valueAndUnit) > 0)}
          />
        </div>
        {allowanceSelectedIndex !== undefined ? (
          <div className="update-buttons">
            <button className="btn btn-sm btn-warning" type="button" onClick={() => {}}>
              <FaPencilAlt />
            </button>
            <button
              className="btn btn-sm btn-danger"
              type="button"
              onClick={() => deleteAllowance(allowanceSelectedIndex)}
            >
              <FaTrash />
            </button>
            <button
              className="btn btn-sm btn-secondary"
              type="button"
              onClick={() => setAllowanceSelectedIndex(undefined)}
            >
              <MdCancel />
            </button>
          </div>
        ) : (
          <button
            className={cx('btn btn-sm btn-success')}
            type="button"
            onClick={handleAddAllowance}
            disabled={!validityTest()}
          >
            <FaPlus />
          </button>
        )}
      </div>
    </div>
  );
}
