import React, { useEffect, useState } from 'react';
import nextId from 'react-id-generator';
import './InputGroupSNCF.scss';

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
  condensed?: boolean;
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
  condensed = false,
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
    <div className={`form-control-container ${selected.unit ? 'has-right-icon' : ''}`}>
      <input
        type="text"
        className={`form-control ${condensed ? 'px-2' : ''}`}
        title={placeholder}
        placeholder={placeholder}
        onChange={(e) => handleType({ type: selected.id, value: e.target.value })}
        value={value}
      />
      <span className="form-control-state" />
      {selected.unit && (
        <span className={`form-control-icon small ${condensed ? 'condensed-icon' : ''}`}>
          {selected.unit}
        </span>
      )}
    </div>
  );

  return (
    <>
      {label && <label htmlFor={id}>{label}</label>}
      <div className={`input-group ${sm && 'input-group-sm'}`}>
        {orientation === 'right' && inputField}
        <div className={`input-group-${orientation === 'left' ? 'prepend' : 'append'}`}>
          {' '}
          <div className="btn-group dropdown">
            <button
              type="button"
              className={`btn btn-secondary dropdown-toggle ${condensed ? 'pr-1 pl-2' : ''}`}
              onClick={() => setIsDropdownShown(!isDropdownShown)}
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls={id}
            >
              <span>{selected.label}</span>
              <i
                className={isDropdownShown ? 'icons-arrow-up' : 'icons-arrow-down'}
                aria-hidden="true"
              />
            </button>
            <div
              className={`dropdown-menu dropdown-menu-right osrd-dropdown-sncf ${
                isDropdownShown ? 'show' : null
              }`}
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
      </div>
    </>
  );
}
