import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import './InputGroupSNCF.scss';

export default function InputGroupSNCF(props) {
  const { id, handleType, options, placeholder, sm, title, value, type } = props;
  const [selected, setSelected] = useState(
    value
      ? {
          label: title,
        }
      : { id: options[0].id, label: options[0].label, unit: options[0].unit }
  );
  /*
  useEffect(() => {
    const selectedOption = value
    ? {
        label: title,
      }
    : { id: options[0].id, label: options[0].label, unit: options[0].unit }

    setSelected(selectedOption);
  }, [options]);
*/
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
        <div className="btn-group dropdown" data-component="select-radios">
          <button
            type="button"
            className="btn btn-secondary dropdown-toggle"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
            aria-controls={id}
          >
            <span data-role="placeholder">{selected.label}</span>
            <i className="icons-arrow-down" aria-hidden="true" />
          </button>
          <div className="dropdown-menu dropdown-menu-right" id={id}>
            {options.map((option) => (
              <React.Fragment key={nextId()}>
                <label className="dropdown-item" htmlFor={option.id}>
                  <div
                    onClick={() => {
                      setSelected(option);
                      handleType({ type: option.id, value: 0 });
                    }}
                    role="button"
                    tabIndex="0"
                  >
                    {option.label}
                  </div>
                </label>
                <input
                  data-role="value"
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
