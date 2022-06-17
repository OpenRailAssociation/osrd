import React, { Component } from 'react';

import { MAP_MODES } from 'common/Map/const';
import PropTypes from 'prop-types';

export default class SelectSNCF extends Component {
    static propTypes = {
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      name: PropTypes.string,
      options: PropTypes.array.isRequired,
      selectedValue: PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.string,
      ]).isRequired,
      onChange: PropTypes.func.isRequired,
      labelKey: PropTypes.string,
      selectStyle: PropTypes.string,
      mode: PropTypes.string,
      sm: PropTypes.bool,
      // type: pt
    }

    static defaultProps = {
      title: '',
      labelKey: 'name',
      selectStyle: '',
      name: '',
      mode: '',
      type: 'improved',
      sm: false,
    }

    renderOptions = (options, labelKey, selectedValue) => options.map((option) => {
      if (typeof option === 'string') {
        return (
          <option
            key={option}
            value={option}
            selected = {option === selectedValue}
          >
            {option}
          </option>
        );
      }
      return (
        <option
          key={option.id || option.key}
          value={JSON.stringify(option)}
          selected = {JSON.stringify(option) === JSON.stringify(selectedValue)}
        >
          {option[labelKey] || `${option.lastName} ${option.firstName}`}
        </option>
      );
    })

    render() {
      const {
        id, title, name, options, selectedValue, onChange, labelKey, selectStyle, mode, sm,
      } = this.props;

      return (
        <>
          <label htmlFor={id}>{title}</label>
          {mode === MAP_MODES.modification
            ? (
              <select
                id={id}
                name={name}
                value={typeof selectedValue === 'string' ? selectedValue : JSON.stringify(selectedValue)}
                onChange={onChange}
                className={`${selectStyle} ${sm && 'sm'}`}
              >
                {this.renderOptions(options, labelKey, selectedValue)}
              </select>
            )
            : (
              <select
                id={id}
                name={name}
                defaultValue={typeof selectedValue === 'string' ? selectedValue : JSON.stringify(selectedValue)}
                onChange={onChange}
                className={`${selectStyle} ${sm && 'sm'}`}
              >
                {this.renderOptions(options, labelKey, selectedValue)}
              </select>
            )}
        </>
      );
    }
}
