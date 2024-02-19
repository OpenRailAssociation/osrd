import React, { useEffect, useMemo, useState } from 'react';

import { Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BiArrowFromLeft, BiArrowFromRight } from 'react-icons/bi';
import { BsCheckLg } from 'react-icons/bs';
import { CgArrowsShrinkH } from 'react-icons/cg';
import { FaPlus, FaSearch } from 'react-icons/fa';
import { MdCancel } from 'react-icons/md';

import type { EngineeringAllowance, PathWaypoint } from 'common/api/osrdEditoastApi';
import InputGroupSNCF, { type InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { removeElementAtIndex, replaceElementAtIndex } from 'utils/array';

import AllowancesModalOP from './AllowancesModalOP';
import { unitsList, unitsNames, unitsTypes } from './consts';
import getAllowanceValue, {
  fillAllowancesWithDefaultRanges,
  findAllowanceOverlap,
  getExactEndPosition,
  getFirstEmptyRange,
  getFirstEmptyRangeFromPosition,
} from './helpers';
import {
  AllowancesTypes,
  type SetAllowanceSelectedIndexType,
  ActionOnAllowance,
  type OverlapAllowancesIndexesType,
  type AllowanceValueForm,
  type RangeAllowanceForm,
  type EngineeringAllowanceForm,
} from './types';

interface Props<T extends RangeAllowanceForm | EngineeringAllowanceForm> {
  allowances: T[];
  defaultAllowance?: AllowanceValueForm;
  pathLength: number;
  pathFindingWaypoints?: PathWaypoint[];
  allowanceSelectedIndex?: number;
  updateAllowances: (allowances: T[]) => void;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
  setOverlapAllowancesIndexes: (overlapAllowancesIndexes: OverlapAllowancesIndexesType) => void;
  type: 'engineering' | 'standard';
  overlapAllowancesIndexes: OverlapAllowancesIndexesType;
}

const AllowancesActions = <T extends RangeAllowanceForm | EngineeringAllowanceForm>({
  allowances,
  pathLength,
  pathFindingWaypoints,
  allowanceSelectedIndex,
  setAllowanceSelectedIndex,
  setOverlapAllowancesIndexes,
  updateAllowances,
  type,
  defaultAllowance,
  overlapAllowancesIndexes,
}: Props<T>) => {
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

  const roundedPathLength = useMemo(() => Math.round(pathLength), [pathLength]);
  const [isMarginDefinedEverywhere, setIsMarginDefinedEverywhere] = useState(false);

  const [beginPosition, setBeginPosition] = useState(0);
  const [endPosition, setEndPosition] = useState(roundedPathLength);

  const [allowanceLength, setAllowanceLength] = useState(endPosition - beginPosition);
  const [distribution, setDistribution] = useState(distributionsList[0].value);
  const [valueAndUnit, setValueAndUnit] = useState<AllowanceValueForm>();
  const [isValid, setIsValid] = useState(false);
  const [nextPosition, setNextPosition] = useState(0);

  const allowanceValue = useMemo(() => {
    if (valueAndUnit) return getAllowanceValue(valueAndUnit);
    return undefined;
  }, [valueAndUnit]);

  const isDisabled = useMemo(
    () => isMarginDefinedEverywhere && allowanceSelectedIndex === undefined,
    [isMarginDefinedEverywhere, allowanceSelectedIndex]
  );

  function checkValidity() {
    if (isMarginDefinedEverywhere && allowanceSelectedIndex === undefined) {
      setOverlapAllowancesIndexes([false, false]);
      return;
    }
    const newOverlapAllowancesIndexes = findAllowanceOverlap({
      allowances,
      beginPosition,
      endPosition,
      currentAllowanceSelected: allowanceSelectedIndex,
    });
    setOverlapAllowancesIndexes(newOverlapAllowancesIndexes);
    if (!newOverlapAllowancesIndexes.every((index) => index === false || index === -1)) {
      setIsValid(false);
      return;
    }
    setIsValid(!!allowanceValue && beginPosition < endPosition && endPosition <= roundedPathLength);
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

  const updateInputRangeExtremities = () => {
    if (allowanceSelectedIndex !== undefined && allowances.length > allowanceSelectedIndex) {
      const selectedAllowance = allowances[allowanceSelectedIndex];
      setBeginPosition(selectedAllowance.begin_position);
      setEndPosition(Math.round(selectedAllowance.end_position));
      setAllowanceLength(
        Math.round(selectedAllowance.end_position) - selectedAllowance.begin_position
      );
      setValueAndUnit(selectedAllowance.value);
      if (type === AllowancesTypes.engineering) {
        const selectedEngineeringAllowance = allowances[
          allowanceSelectedIndex
        ] as EngineeringAllowance;
        setDistribution(selectedEngineeringAllowance.distribution);
      }
      return;
    }

    let firstEmptyRange = getFirstEmptyRangeFromPosition(allowances, nextPosition, pathLength);
    if (!firstEmptyRange) {
      firstEmptyRange = getFirstEmptyRange(allowances, pathLength);
    }

    if (firstEmptyRange) {
      setBeginPosition(firstEmptyRange.beginPosition);
      setEndPosition(Math.round(firstEmptyRange.endPosition));
      setIsMarginDefinedEverywhere(false);
      if (setOverlapAllowancesIndexes) setOverlapAllowancesIndexes([false, false]);
    } else {
      // if no empty range, disable all the inputs
      setIsMarginDefinedEverywhere(true);
    }
  };

  const handleManageAllowance = (action: ActionOnAllowance) => {
    let newAllowancesRanges = [...allowances] as T[];
    if (action === ActionOnAllowance.delete && allowanceSelectedIndex !== undefined) {
      newAllowancesRanges = removeElementAtIndex(allowances, allowanceSelectedIndex);
    } else {
      const newAllowance = {
        begin_position: beginPosition,
        end_position: getExactEndPosition(endPosition, roundedPathLength, pathLength),
        value: valueAndUnit,
        ...(type === AllowancesTypes.engineering
          ? {
              allowance_type: type,
              distribution,
            }
          : {}),
      } as T;
      if (action === ActionOnAllowance.add) {
        newAllowancesRanges = sortBy(
          [...allowances, newAllowance],
          (allowance) => allowance.begin_position
        );
      } else if (action === ActionOnAllowance.update && allowanceSelectedIndex !== undefined) {
        newAllowancesRanges = replaceElementAtIndex(
          allowances,
          allowanceSelectedIndex,
          newAllowance
        );
      }
      setNextPosition(newAllowance.end_position + 1);
    }

    if (type === AllowancesTypes.standard && defaultAllowance) {
      newAllowancesRanges = fillAllowancesWithDefaultRanges(
        newAllowancesRanges,
        defaultAllowance,
        pathLength
      ) as T[];
    }

    updateAllowances(newAllowancesRanges);
  };

  const handleValueAndUnit = (newValueAndUnit: InputGroupSNCFValue) => {
    if (newValueAndUnit.type) {
      setValueAndUnit({
        value_type: newValueAndUnit.type as AllowanceValueForm['value_type'],
        [unitsNames[newValueAndUnit.type as keyof typeof unitsNames]]:
          newValueAndUnit.value && newValueAndUnit.value !== ''
            ? +newValueAndUnit.value
            : undefined,
      } as AllowanceValueForm);
    }
  };

  const defaultType = () => {
    if (type === AllowancesTypes.standard) return unitsTypes.percentage;
    if (type === AllowancesTypes.engineering) return unitsTypes.time;
    return unitsNames.percentage;
  };

  // Test validity at each change
  useEffect(() => {
    checkValidity();
  }, [
    beginPosition,
    endPosition,
    allowanceValue,
    allowanceSelectedIndex,
    isMarginDefinedEverywhere,
  ]);

  useEffect(() => {
    updateInputRangeExtremities();
  }, [allowances, allowanceSelectedIndex, isDisabled, defaultAllowance]);

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
            textRight
            min={0}
            isInvalid={
              beginPosition >= endPosition ||
              (!beginPosition && beginPosition !== 0) ||
              ![-1, false].includes(overlapAllowancesIndexes[0])
            }
            value={beginPosition}
            onChange={(e) => handleInputFrom(+e.target.value)}
            appendOptions={
              pathFindingWaypoints && {
                label: <FaSearch />,
                name: 'op-begin-position',
                onClick: () =>
                  openModal(
                    <AllowancesModalOP
                      setPosition={setBeginPosition}
                      pathFindingWaypoints={pathFindingWaypoints}
                    />
                  ),
              }
            }
            disabled={isDisabled}
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
            textRight
            min={0}
            isInvalid={
              beginPosition >= endPosition ||
              (!endPosition && endPosition !== 0) ||
              endPosition > roundedPathLength ||
              ![-1, false].includes(overlapAllowancesIndexes[1])
            }
            value={endPosition}
            onChange={(e) => handleInputTo(+e.target.value)}
            appendOptions={
              pathFindingWaypoints && {
                label: <FaSearch />,
                name: 'op-end-position',
                onClick: () =>
                  openModal(
                    <AllowancesModalOP
                      setPosition={setEndPosition}
                      pathFindingWaypoints={pathFindingWaypoints}
                    />
                  ),
              }
            }
            disabled={isDisabled}
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
            textRight
            min={1}
            isInvalid={allowanceLength < 1}
            value={allowanceLength}
            onChange={(e) => handleInputLength(+e.target.value)}
            disabled={isDisabled}
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
        <div className="allowances-value" data-testid="engineering-allowance-group">
          <InputGroupSNCF
            id={`allowances-${type}-value`}
            orientation="right"
            sm
            condensed
            value={allowanceValue}
            handleUnit={handleValueAndUnit}
            options={unitsList}
            typeValue="number"
            unit={valueAndUnit?.value_type || defaultType()}
            min={1}
            isInvalid={allowanceValue !== undefined && allowanceValue < 1}
            textRight
            disabled={isDisabled}
            inputDataTestId="allowances-engineering-allowance-input"
          />
        </div>
        {allowanceSelectedIndex !== undefined ? (
          <div className="update-buttons">
            <button
              className="btn btn-sm btn-success"
              type="button"
              aria-label={t('saveAllowances')}
              title={t('saveAllowances')}
              onClick={() => handleManageAllowance(ActionOnAllowance.update)}
              disabled={!isValid}
            >
              <BsCheckLg />
            </button>
            {allowances[allowanceSelectedIndex] &&
              !allowances[allowanceSelectedIndex].isDefault && (
                <button
                  className="btn btn-sm btn-danger"
                  type="button"
                  aria-label={t('deleteAllowance')}
                  title={t('deleteAllowance')}
                  onClick={() => handleManageAllowance(ActionOnAllowance.delete)}
                >
                  <Trash />
                </button>
              )}
            <button
              className="btn btn-sm btn-secondary"
              type="button"
              aria-label={t('cancel')}
              title={t('cancel')}
              onClick={() => setAllowanceSelectedIndex(undefined)}
            >
              <MdCancel />
            </button>
          </div>
        ) : (
          <button
            className={cx('btn btn-sm btn-success')}
            aria-label={t('addAllowance')}
            title={t('addAllowance')}
            type="button"
            onClick={() => handleManageAllowance(ActionOnAllowance.add)}
            disabled={!isValid || isMarginDefinedEverywhere}
            data-testid="add-allowance-button"
          >
            <FaPlus />
          </button>
        )}
      </div>
    </div>
  );
};

export default AllowancesActions;
