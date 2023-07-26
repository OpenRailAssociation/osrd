import React, { useEffect, useState } from 'react';
import nextId from 'react-id-generator';
import './InputGroupSNCF.scss';
import cx from 'classnames';

type Option = {
  id: string;
  label: string;
  unit?: string;
};

export type InputGroupSNCFValue = { type?: string; value?: string | number };

type Props = {
  id: string;
  label?: React.ReactElement;
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
}: Props) {
  const [isDropdownShown, setIsDropdownShown] = useState(false);
  const [selected, setSelected] = useState(
    value
      ? {
          label: title,
        }
      : { id: options[0].id, label: options[0].label, unit: options[0].unit }
  );

  useEffect(() => {
    const selectedOption = options?.find((option) => option.id === type);

    setSelected({
      label: selectedOption?.label || options[0].label,
      id: selectedOption?.id || options[0].id,
      unit: selectedOption?.unit || options[0].unit,
    });
  }, [type, options]);

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
        className={cx('form-control h-100', condensed && 'px-2')}
        title={placeholder}
        placeholder={placeholder}
        onChange={(e) => handleType({ type: selected.id, value: e.target.value })}
        value={value}
        min={min}
        max={max}
        data-testid="input-group-first-field"
        step={step}
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
              {options.map((option) => (
                <React.Fragment key={nextId()}>
                  <label className="dropdown-item" htmlFor={option.id}>
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
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        {orientation === 'left' && inputField}
        {isDropdownShown && (
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
