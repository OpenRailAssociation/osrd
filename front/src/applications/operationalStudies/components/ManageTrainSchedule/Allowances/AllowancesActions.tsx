import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import { CgArrowsShrinkH } from 'react-icons/cg';
import { BiArrowFromLeft, BiArrowFromRight } from 'react-icons/bi';
import {
  AllowanceValue,
  EngineeringAllowance,
  PathStep,
  RangeAllowance,
} from 'common/api/osrdEditoastApi';
import { BsCheckLg } from 'react-icons/bs';
import { MdCancel } from 'react-icons/md';
import cx from 'classnames';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { unitsList, unitsNames, unitsTypes } from './consts';
import {
  AllowancesTypes,
  SetAllowanceSelectedIndexType,
  ManageAllowancesType,
  ActionOnAllowance,
  OverlapAllowancesIndexesType,
} from './types';
import getAllowanceValue, { findAllowanceOverlap } from './helpers';
import AllowancesModalOP from './AllowancesModalOP';

type Props = {
  allowances: RangeAllowance[] | EngineeringAllowance[];
  manageAllowance: (props: ManageAllowancesType) => void;
  pathLength: number;
  pathFindingSteps?: PathStep[];
  allowanceSelectedIndex?: number;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
  setOverlapAllowancesIndexes?: (overlapAllowancesIndexes: OverlapAllowancesIndexesType) => void;
  type: 'engineering' | 'standard';
};

export default function AllowancesActions({
  allowances,
  manageAllowance,
  pathLength,
  pathFindingSteps,
  allowanceSelectedIndex,
  setAllowanceSelectedIndex,
  setOverlapAllowancesIndexes,
  type,
}: Props) {
  const { t } = useTranslation('operationalStudies/allowances');
  const { openModal } = useModal();
  const distributionsList = [
    {
      label: (
        <>
          <span className="bullet-linear">●</span>
          {t('distribution.linear')}
        </>
      ),
      value: 'LINEAR',
    },
    {
      label: (
        <>
          <span className="bullet-mareco">●</span>
          {t('distribution.mareco')}
        </>
      ),
      value: 'MARECO',
    },
  ];
  const [beginPosition, setBeginPosition] = useState(0);
  const [endPosition, setEndPosition] = useState(pathLength);
  const [allowanceLength, setAllowanceLength] = useState(endPosition - beginPosition);
  const [distribution, setDistribution] = useState(distributionsList[0].value);
  const [valueAndUnit, setValueAndUnit] = useState<AllowanceValue>();
  const [isValid, setIsValid] = useState(false);

  function validityTest() {
    if (setOverlapAllowancesIndexes) {
      const overlapAllowancesIndexes = findAllowanceOverlap({
        allowances,
        beginPosition,
        endPosition,
        currentAllowanceSelected: allowanceSelectedIndex,
      });
      setOverlapAllowancesIndexes(overlapAllowancesIndexes);
      if (!overlapAllowancesIndexes.every((index) => index === false || index === -1)) return false;
    }
    return (
      beginPosition < endPosition &&
      getAllowanceValue(valueAndUnit) > 0 &&
      endPosition <= pathLength
    );
  }

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

  const handleManageAllowance = (action: ActionOnAllowance) => {
    let newAllowance;
    if (action === ActionOnAllowance.add || action === ActionOnAllowance.update) {
      if (type === AllowancesTypes.standard) {
        newAllowance = {
          begin_position: beginPosition,
          end_position: endPosition,
          value: valueAndUnit,
        } as RangeAllowance;
      }
      if (type === AllowancesTypes.engineering) {
        newAllowance = {
          allowance_type: type,
          distribution,
          begin_position: beginPosition,
          end_position: endPosition,
          value: valueAndUnit,
        } as EngineeringAllowance;
      }
    }
    manageAllowance({
      type: type as AllowancesTypes,
      newAllowance,
      allowanceIndexToDelete:
        action === ActionOnAllowance.delete || action === ActionOnAllowance.update
          ? allowanceSelectedIndex
          : undefined,
    });
    // Follow natural behaviour of allowances determination
    setBeginPosition(endPosition + 1);
    setEndPosition(pathLength);
  };

  const handleValueAndUnit = (newValueAndUnit: InputGroupSNCFValue) => {
    if (newValueAndUnit.type && newValueAndUnit.value !== undefined) {
      setValueAndUnit({
        value_type: newValueAndUnit.type as AllowanceValue['value_type'],
        [unitsNames[newValueAndUnit.type as keyof typeof unitsNames]]: +newValueAndUnit.value,
      } as AllowanceValue);
    }
  };

  const defaultType = () => {
    if (type === AllowancesTypes.standard) return unitsTypes.percentage;
    if (type === AllowancesTypes.engineering) return unitsTypes.time;
    return unitsNames.percentage;
  };

  useEffect(() => {
    if (allowanceSelectedIndex !== undefined) {
      if (type === AllowancesTypes.standard) {
        const selectedAllowance = allowances[allowanceSelectedIndex] as RangeAllowance;
        setBeginPosition(selectedAllowance.begin_position);
        setEndPosition(selectedAllowance.end_position);
        setAllowanceLength(selectedAllowance.end_position - selectedAllowance.begin_position);
        setValueAndUnit(selectedAllowance.value);
      }
      if (type === AllowancesTypes.engineering) {
        const selectedAllowance = allowances[allowanceSelectedIndex] as EngineeringAllowance;
        setBeginPosition(selectedAllowance.begin_position);
        setEndPosition(selectedAllowance.end_position);
        setAllowanceLength(selectedAllowance.end_position - selectedAllowance.begin_position);
        setDistribution(selectedAllowance.distribution);
        setValueAndUnit(selectedAllowance.value);
      }
    }
  }, [allowanceSelectedIndex]);

  // Test validity at each change
  useEffect(() => {
    setIsValid(validityTest());
  }, [beginPosition, endPosition, valueAndUnit, allowanceSelectedIndex]);

  useEffect(() => {
    if (allowanceSelectedIndex === undefined) {
      const newBeginPosition = allowances?.at(-1)?.end_position;
      const newEndPosition =
        newBeginPosition && newBeginPosition === pathLength ? pathLength + 1 : pathLength;
      setBeginPosition(newBeginPosition ? newBeginPosition + 1 : 0);
      setEndPosition(newEndPosition);
      if (newBeginPosition) setAllowanceLength(newEndPosition - newBeginPosition + 1);
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
            appendOptions={
              pathFindingSteps && {
                label: <FaSearch />,
                name: 'op-begin-position',
                onClick: () =>
                  openModal(
                    <AllowancesModalOP
                      setPosition={setBeginPosition}
                      pathFindingSteps={pathFindingSteps}
                    />
                  ),
              }
            }
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
            isInvalid={
              beginPosition >= endPosition ||
              (!endPosition && endPosition !== 0) ||
              endPosition > pathLength
            }
            value={endPosition}
            onChange={(e) => handleInputTo(+e.target.value)}
            appendOptions={
              pathFindingSteps && {
                label: <FaSearch />,
                name: 'op-end-position',
                onClick: () =>
                  openModal(
                    <AllowancesModalOP
                      setPosition={setEndPosition}
                      pathFindingSteps={pathFindingSteps}
                    />
                  ),
              }
            }
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
        {type === AllowancesTypes.engineering && (
          <div>
            <OptionsSNCF
              name="allowances-engineering-distribution-switch"
              onChange={(e) => setDistribution(e.target.value)}
              selectedValue={distribution}
              options={distributionsList}
              sm
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
            handleType={handleValueAndUnit}
            options={unitsList}
            typeValue="number"
            type={valueAndUnit?.value_type || defaultType()}
            min={0}
            isInvalid={!(getAllowanceValue(valueAndUnit) > 0)}
          />
        </div>
        {allowanceSelectedIndex !== undefined ? (
          <div className="update-buttons">
            <button
              className="btn btn-sm btn-success"
              type="button"
              onClick={() => handleManageAllowance(ActionOnAllowance.update)}
              disabled={!isValid}
            >
              <BsCheckLg />
            </button>
            <button
              className="btn btn-sm btn-danger"
              type="button"
              onClick={() => handleManageAllowance(ActionOnAllowance.delete)}
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
            onClick={() => handleManageAllowance(ActionOnAllowance.add)}
            disabled={!isValid}
          >
            <FaPlus />
          </button>
        )}
      </div>
    </div>
  );
}
