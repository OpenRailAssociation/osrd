import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { MAP_MODES } from 'common/Map/const';

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
      // type: pt
    }

    static defaultProps = {
      title: '',
      labelKey: 'name',
      selectStyle: '',
      name: '',
      mode: '',
      type: 'improved',
    }

    renderOptions = (options, labelKey) => options.map((option) => {
      if (typeof option === 'string') {
        return (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        );
      }
      return (
        <option
          key={option.id || option.key}
          value={JSON.stringify(option)}
        >
          {option[labelKey] || `${option.lastName} ${option.firstName}`}
        </option>
      );
    })

    render() {
      const {
        id, title, name, options, selectedValue, onChange, labelKey, selectStyle, mode,
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
                className={selectStyle}
              >
                {this.renderOptions(options, labelKey)}
              </select>
            )
            : (
              <select
                id={id}
                name={name}
                defaultValue={typeof selectedValue === 'string' ? selectedValue : JSON.stringify(selectedValue)}
                onChange={onChange}
                className={selectStyle}
              >
                {this.renderOptions(options, labelKey)}
              </select>
            )}
        </>
      );
    }
}
