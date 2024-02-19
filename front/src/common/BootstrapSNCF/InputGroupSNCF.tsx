import React, { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import cx from 'classnames';
import { isNil } from 'lodash';
import nextId from 'react-id-generator';
import './InputGroupSNCF.scss';

import { isFloat, stripDecimalDigits } from 'utils/numbers';

type Option = {
  id: string;
  label: string;
  unit?: string;
};

export type InputGroupSNCFValue = { type?: string; unit: string; value?: string | number };

type Props = {
  id: string;
  label?: React.ReactElement | string;
  options: Option[];
  unit: string;
  handleUnit: (type: InputGroupSNCFValue) => void;
  orientation?: string;
  placeholder?: string;
  sm?: boolean;
  value?: number | string;
  typeValue?: string;
  condensed?: boolean;
  isInvalid?: boolean;
  errorMsg?: string;
  min?: number;
  max?: number;
  step?: number | string;
  textRight?: boolean;
  disabled?: boolean;
  disableUnitSelector?: boolean;
  limitDecimal?: number;
  inputDataTestId?: string;
};

const isNeedStripDecimalDigits = (inputValue: string, limit: number) => {
  const eventValue = Number(inputValue);
  return !isNil(limit) && limit > 0 && inputValue !== '' && isFloat(eventValue);
};

export default function InputGroupSNCF({
  id,
  label,
  unit,
  handleUnit,
  options,
  orientation = 'left',
  placeholder = '',
  sm = false,
  value,
  typeValue = 'text',
  condensed = false,
  isInvalid = false,
  errorMsg,
  min,
  max,
  step,
  textRight = false,
  disabled = false,
  disableUnitSelector = false,
  limitDecimal = 10,
  inputDataTestId,
}: Props) {
  const [isDropdownShown, setIsDropdownShown] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Option>({
    id: options[0].id,
    label: options[0].label,
    unit: options[0].unit,
  });

  const textAlignmentClass = textRight ? 'right-alignment' : 'left-alignment';

  useEffect(() => {
    // Check if we can find the unit in the options id (allowances) or label (rolling stock editor)
    const selectedOption = options?.find((option) => option.id === unit || option.label === unit);
    setSelectedUnit({
      label: selectedOption?.label || options[0].label,
      id: selectedOption?.id || options[0].id,
      unit: selectedOption?.unit || options[0].unit,
    });
  }, [unit, options]);

  const handleOnChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const eventValue = Number(event.target.value);
      const selectedUnitValue: InputGroupSNCFValue['value'] =
        limitDecimal && isNeedStripDecimalDigits(event.target.value, limitDecimal)
          ? stripDecimalDigits(eventValue, limitDecimal)
          : event.target.value;
      handleUnit({ type: selectedUnit.id, unit: selectedUnit.label, value: selectedUnitValue });
    },
    [handleUnit, selectedUnit, limitDecimal]
  );

  const inputValue = useMemo(() => {
    if (value !== undefined && !disabled) {
      if (limitDecimal && isNeedStripDecimalDigits(value.toString(), limitDecimal)) {
        return stripDecimalDigits(Number(value), limitDecimal);
      }
      return value;
    }
    return '';
  }, [value, limitDecimal, disabled]);

  const inputField = (
    <div
      className={cx('form-control-container', {
        'is-invalid': isInvalid,
      })}
    >
      <input
        type={typeValue}
        className={cx('form-control h-100', textAlignmentClass, {
          'px-2': condensed,
        })}
        title={placeholder}
        placeholder={placeholder}
        onChange={handleOnChange}
        value={inputValue}
        min={min}
        max={max}
        data-testid={inputDataTestId}
        step={step}
        disabled={disabled}
      />
      <span className="form-control-state" />
    </div>
  );

  return (
    <>
      {label && (
        <label htmlFor={id} className="my-0 mr-2">
          {label}
        </label>
      )}
      <div
        className={cx('input-group', {
          'input-group-sm': sm,
        })}
      >
        {orientation === 'right' && inputField}
        <div
          className={cx({
            'input-group-prepend': orientation === 'left',
            'input-group-append': orientation !== 'left',
          })}
        >
          {' '}
          <div className="btn-group dropdown">
            <button
              type="button"
              className={cx('btn btn-secondary dropdown-toggle', {
                'pr-2 pl-2': condensed,
              })}
              onClick={() => setIsDropdownShown(!isDropdownShown)}
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls={id}
              disabled={disabled || disableUnitSelector}
            >
              <span className={cx({ small: condensed })}>{selectedUnit.label}</span>
              <i
                className={cx(isDropdownShown ? 'icons-arrow-up' : 'icons-arrow-down', {
                  'ml-2': condensed,
                })}
                aria-hidden="true"
              />
            </button>
            <div
              className={cx('dropdown-menu dropdown-menu-right osrd-dropdown-sncf', {
                show: isDropdownShown,
              })}
              id={id}
              // eslint-disable-next-line react/no-unknown-property
              x-placement="bottom-end"
            >
              {options.map((option) => (
                <div
                  key={nextId()}
                  onClick={() => {
                    setSelectedUnit(option);
                    handleUnit({
                      type: option.id,
                      unit: option.label,
                      value,
                    });
                    setIsDropdownShown(false);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <label className="dropdown-item" htmlFor={option.id}>
                    {option.label}
                  </label>
                  <input
                    type="radio"
                    name={id}
                    value={option.id}
                    id={option.id}
                    className="sr-only"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        {orientation === 'left' && inputField}
        {isDropdownShown && (
          // eslint-disable-next-line jsx-a11y/control-has-associated-label
          <div
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              width: '100vw',
              height: '100vh',
              zIndex: 999,
            }}
            role="button"
            tabIndex={0}
            onClick={() => setIsDropdownShown(false)}
          >
            &nbsp;
          </div>
        )}
        {isInvalid && <div className="invalid-feedback">{errorMsg}</div>}
      </div>
    </>
  );
}
