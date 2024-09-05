import { type ChangeEvent, useCallback, useMemo, useState } from 'react';

import cx from 'classnames';
import { isNil } from 'lodash';

import type { MultiUnit } from 'modules/rollingStock/types';
import { isFloat, stripDecimalDigits } from 'utils/numbers';

type Option = {
  id: string;
  label: string;
};

export type InputGroupSNCFValue<U> = { unit: U; value?: number };

// Generic allow us to custom the type of unit used in this component
type Props<U> = {
  id: string;
  label?: React.ReactElement | string;
  options: Option[];
  onChange: (type: InputGroupSNCFValue<U>) => void;
  currentValue: {
    unit: U;
    value?: number;
  };
  isInvalid?: boolean;
  errorMsg?: string;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
  limitDecimal?: number;
  inputDataTestId?: string;
};

const isNeedStripDecimalDigits = (inputValue: string, limit: number) => {
  const eventValue = Number(inputValue);
  return !isNil(limit) && limit > 0 && inputValue !== '' && isFloat(eventValue);
};

export default function InputGroupSNCF<U extends string | MultiUnit>({
  id,
  label,
  onChange,
  options,
  currentValue,
  isInvalid = false,
  errorMsg,
  min,
  max,
  step = 'any',
  disabled = false,
  limitDecimal = 10,
  inputDataTestId,
}: Props<U>) {
  const [isDropdownShown, setIsDropdownShown] = useState(false);

  const handleValueChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const eventValue = Number(event.target.value);
      let newValue: InputGroupSNCFValue<U>['value'] =
        limitDecimal && isNeedStripDecimalDigits(event.target.value, limitDecimal)
          ? stripDecimalDigits(eventValue, limitDecimal)
          : eventValue;
      if (event.target.value === '') newValue = undefined;
      onChange({ unit: currentValue.unit, value: newValue });
    },
    [onChange, currentValue.unit, limitDecimal]
  );

  const inputValue = useMemo(() => {
    const { value } = currentValue;
    if (value !== undefined && !disabled) {
      if (limitDecimal && isNeedStripDecimalDigits(value.toString(), limitDecimal)) {
        return stripDecimalDigits(Number(value), limitDecimal);
      }
      return value;
    }
    return '';
  }, [currentValue.value, limitDecimal, disabled]);

  const inputField = (
    <div
      className={cx('form-control-container', {
        'is-invalid': isInvalid,
      })}
    >
      <input
        type="number"
        className="form-control h-100 px-2 text-right"
        title={inputValue.toString()}
        onChange={handleValueChange}
        value={inputValue}
        min={min}
        max={max}
        step={step}
        data-testid={inputDataTestId}
        disabled={disabled}
      />
      <span className="form-control-state" />
    </div>
  );

  const currentUnitLabel = useMemo(() => {
    const currentUnit = options.find((option) => option.id === currentValue.unit);
    return currentUnit?.label || currentValue.unit;
  }, [options, currentValue.unit]);

  return (
    <>
      {label && (
        <label htmlFor={id} className="my-0 mr-2">
          {label}
        </label>
      )}
      <div className="input-group">
        {inputField}
        <div className="input-group-append">
          <div className="btn-group dropdown">
            <button
              type="button"
              className="btn btn-secondary px-2 dropdown-toggle"
              onClick={() => setIsDropdownShown(!isDropdownShown)}
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls={id}
              disabled={disabled}
            >
              <span className="small">{currentUnitLabel}</span>
              <i
                className={cx('ml-2', isDropdownShown ? 'icons-arrow-up' : 'icons-arrow-down')}
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
                  key={`${option.id}-${currentValue.unit}`}
                  onClick={() => {
                    onChange({
                      unit: option.id as U,
                      value: currentValue.value,
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
