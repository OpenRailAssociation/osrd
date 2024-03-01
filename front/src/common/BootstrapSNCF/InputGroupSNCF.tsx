import React, { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import nextId from 'react-id-generator';
import './InputGroupSNCF.scss';
import cx from 'classnames';
import { isFloat, stripDecimalDigits } from 'utils/numbers';
import { isNil } from 'lodash';

type Option = {
  id: string;
  label: string;
  unit?: string;
};

export type InputGroupSNCFValue = { type?: string; value?: string | number };

type Props = {
  id: string;
  label?: React.ReactElement | string;
  options: Option[];
  handleType: (type: InputGroupSNCFValue) => void;
  orientation?: string;
  placeholder?: string;
  sm?: boolean;
  title?: string;
  value?: number | string;
  type?: string;
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
  handleType,
  options,
  orientation = 'left',
  placeholder = '',
  sm = false,
  title,
  value,
  type,
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
  const [selected, setSelected] = useState(
    value
      ? {
          label: title,
        }
      : { id: options[0].id, label: options[0].label, unit: options[0].unit }
  );
  const textAlignmentClass = textRight ? 'right-alignment' : 'left-alignment';

  useEffect(() => {
    const selectedOption = options?.find((option) => option.id === type);

    setSelected({
      label: selectedOption?.label || options[0].label,
      id: selectedOption?.id || options[0].id,
      unit: selectedOption?.unit || options[0].unit,
    });
  }, [type, options]);

  const handleOnChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const eventValue = Number(event.target.value);
      if (limitDecimal && isNeedStripDecimalDigits(event.target.value, limitDecimal)) {
        const limitedValue = stripDecimalDigits(eventValue, limitDecimal);
        handleType({ type: selected.id, value: limitedValue });
      } else {
        handleType({ type: selected.id, value: event.target.value });
      }
    },
    [handleType, selected, limitDecimal]
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
      className={cx(
        'form-control-container',
        selected.unit && 'has-right-icon',
        isInvalid && 'is-invalid'
      )}
    >
      <input
        type={typeValue}
        className={cx('form-control h-100', condensed && 'px-2', textAlignmentClass)}
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
      {selected.unit && (
        <span className={cx('form-control-icon small', condensed && 'condensed-icon')}>
          {selected.unit}
        </span>
      )}
    </div>
  );

  return (
    <>
      {label && (
        <label htmlFor={id} className="my-0 mr-2">
          {label}
        </label>
      )}
      <div className={cx('input-group', sm && 'input-group-sm')}>
        {orientation === 'right' && inputField}
        <div className={`input-group-${orientation === 'left' ? 'prepend' : 'append'}`}>
          {' '}
          <div className="btn-group dropdown">
            <button
              type="button"
              className={cx('btn btn-secondary dropdown-toggle', condensed && 'pr-2 pl-2')}
              onClick={() => setIsDropdownShown(!isDropdownShown)}
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls={id}
              disabled={disabled || disableUnitSelector}
            >
              <span className={cx(condensed && 'small')}>{selected.label}</span>
              <i
                className={cx(
                  isDropdownShown ? 'icons-arrow-up' : 'icons-arrow-down',
                  condensed && ' ml-2'
                )}
                aria-hidden="true"
              />
            </button>
            <div
              className={cx(
                'dropdown-menu dropdown-menu-right osrd-dropdown-sncf',
                isDropdownShown && 'show'
              )}
              id={id}
              // eslint-disable-next-line react/no-unknown-property
              x-placement="bottom-end"
            >
              <ul>
                {options.map((option) => (
                  <li key={nextId()}>
                    <label htmlFor={option.id} className="dropdown-item">
                      <div
                        onClick={() => {
                          setSelected(option);
                          handleType({ type: option.id, value: 0 });
                          setIsDropdownShown(false);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {option.label}
                      </div>
                    </label>
                    <input
                      type="radio"
                      name={id}
                      value={option.id}
                      id={option.id}
                      className="sr-only"
                    />
                  </li>
                ))}
              </ul>
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
