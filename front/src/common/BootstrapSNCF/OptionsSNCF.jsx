/* Usage
 * <OptionsSNCF
 * onChange=function
 * name=string
 * selectedValue=string
 * options={[{ value: string, label: string}, { value: string, label: string}]} />
 */

import React from 'react';
import PropTypes from 'prop-types';
import './OptionsSNCF.scss';

export default function OptionsSNCF(props) {
  const { onChange, options, name, selectedValue, sm } = props;

  return (
    <div className={`options-control ${sm ? 'sm' : ''}`}>
      {options.map((option) => (
        <div className="options-item" key={option.value}>
          <input
            type="radio"
            name={name}
            id={`${name}${option.value}`}
            onChange={onChange}
            className="sr-only"
            value={option.value}
            checked={selectedValue === option.value}
          />
          <label className="options-btn font-weight-medium" htmlFor={`${name}${option.value}`}>
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
}

OptionsSNCF.defaultProps = {
  sm: false,
};

OptionsSNCF.propTypes = {
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array.isRequired,
  name: PropTypes.string.isRequired,
  selectedValue: PropTypes.string.isRequired,
  sm: PropTypes.bool,
};
