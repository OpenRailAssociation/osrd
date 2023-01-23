import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import './InputGroupSNCF.scss';

export default function InputGroupSNCF(props) {
  const { id, handleType, options, placeholder, sm, title, value, type } = props;
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

  return (
    <div className={`input-group ${sm && 'input-group-sm'}`}>
      <div className="input-group-prepend">
        <div className="btn-group dropdown">
          <button
            type="button"
            className="btn btn-secondary dropdown-toggle"
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
            className={`dropdown-menu dropdown-menu-right ${isDropdownShown ? 'show' : null}`}
            id={id}
            // eslint-disable-next-line react/no-unknown-property
            x-placement="bottom-end"
            style={{
              position: 'absolute',
              transform: 'translate3d(-47.0333px, 30px, 0px)',
              top: '0px',
              left: '0px',
              willChange: 'transform',
            }}
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
                    tabIndex="0"
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
      <div className={`form-control-container ${selected.unit && 'has-right-icon'}`}>
        <input
          type="text"
          className="form-control"
          title={placeholder}
          placeholder={placeholder}
          onChange={(e) => handleType({ type: selected.id, value: e.target.value })}
          value={value}
        />
        <span className="form-control-state" />
        {selected.unit && <span className="form-control-icon small">{selected.unit}</span>}
      </div>
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
  );
}

InputGroupSNCF.propTypes = {
  id: PropTypes.string.isRequired,
  options: PropTypes.array.isRequired,
  handleType: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  sm: PropTypes.bool,
  title: PropTypes.string,
  value: PropTypes.number.isRequired,
  type: PropTypes.string,
};

InputGroupSNCF.defaultProps = {
  placeholder: '',
  sm: false,
  title: undefined,
  type: undefined,
};
