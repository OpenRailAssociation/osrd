import React from 'react';

import PropTypes from 'prop-types';

const renderOptions = (options, labelKey, selectedValue) =>
  options.map((option) => {
    if (typeof option === 'string') {
      return (
        <option key={option} value={option} selected={option === selectedValue}>
          {option}
        </option>
      );
    }
    return (
      <option key={option.id || option.key} value={JSON.stringify(option)}>
        {option[labelKey] || `${option.lastName} ${option.firstName}`}
      </option>
    );
  });

export default function SelectSNCF(props) {
  const { id, title, name, options, selectedValue, onChange, labelKey, selectStyle, sm, value } =
    props;

  return (
    <>
      <label htmlFor={id}>{title}</label>
      <select
        id={id}
        name={name}
        /*
        defaultValue={
          typeof selectedValue === 'string' ? selectedValue : JSON.stringify(selectedValue)
        }
        */
        onChange={onChange}
        className={`${selectStyle} ${sm && 'sm'}`}
        value={typeof value === 'string' ? value : JSON.stringify(value)}
      >
        {renderOptions(options, labelKey, selectedValue)}
      </select>
    </>
  );
}

SelectSNCF.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
  name: PropTypes.string,
  options: PropTypes.array.isRequired,
  selectedValue: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  labelKey: PropTypes.string,
  selectStyle: PropTypes.string,
  sm: PropTypes.bool,
};

SelectSNCF.defaultProps = {
  title: '',
  labelKey: 'name',
  selectStyle: '',
  name: '',
  sm: false,
  selectedValue: undefined,
  value: undefined,
};
