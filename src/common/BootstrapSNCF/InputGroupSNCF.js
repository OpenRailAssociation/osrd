import React, { useState } from 'react';
import PropTypes from 'prop-types';

export default function InputGroupSNCF(props) {
  const {
    id, options, onChange, placeholder, title,
  } = props;
  const [selected, setSelected] = useState(title
    ? { label: title } : { id: options[0].id, label: options[0].label });

  return (
    <div className="input-group">
      <div className="input-group-prepend">
        <div className="btn-group dropdown" data-component="select-radios">
          <button type="button" className="btn btn-secondary dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-controls={id}>
            <span data-role="placeholder">{selected.label}</span>
            <i className="icons-arrow-down" aria-hidden="true" />
          </button>
          <div className="dropdown-menu dropdown-menu-right" id={id}>
            {options.map((option) => (
              <>
                <label className="dropdown-item" htmlFor={option.id} onClick={() => setSelected(option)}>
                  {option.label}
                </label>
                <input data-role="value" type="radio" name={id} value={option.id} id={option.id} className="sr-only" />
              </>
            ))}
          </div>
        </div>
      </div>
      <div className="form-control-container">
        <input type="text" className="form-control" title={placeholder} placeholder={placeholder} />
        <span className="form-control-state" />
      </div>
    </div>
  );
}

InputGroupSNCF.propTypes = {
  id: PropTypes.string.isRequired,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  title: PropTypes.string,
};

InputGroupSNCF.defaultProps = {
  placeholder: '',
  title: undefined,
};
