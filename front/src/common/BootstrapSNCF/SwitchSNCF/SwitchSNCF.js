import React, { Component } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import './SwitchSNCF.css';

export const SWITCH_TYPES = {
  inline: 'inline',
  options: 'options',
  radio: 'radio',
  switch: 'switch',
};

export default class SwitchSNCF extends Component {
  static propTypes = {
    type: PropTypes.oneOf(Object.keys(SWITCH_TYPES)).isRequired,
    onChange: PropTypes.func.isRequired,
    options: PropTypes.array,
    checkedName: PropTypes.string,
    name: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    checked: PropTypes.bool,
    warning: PropTypes.bool,
  }

  static defaultProps = {
    options: [],
    checkedName: undefined,
    checked: true,
    warning: false,
  }

  render() {
    const {
      type, options, onChange, checkedName, name, id, checked, warning,
    } = this.props;

    const warningClass = warning ? 'warning' : '';

    switch (type) {
      case SWITCH_TYPES.radio:
        return (
          <>
            {
              options.map((option) => {
                const optionId = `${id}-${nextId()}`;
                return (
                  <div className="custom-control custom-radio" key={`option${nextId()}`}>
                    <input
                      type="radio"
                      id={optionId}
                      name={name}
                      className="custom-control-input"
                      checked={option.value === checkedName}
                      onChange={onChange}
                      value={option.value}
                    />
                    <label className="custom-control-label font-weight-medium" htmlFor={optionId}>
                      {option.label}
                    </label>
                  </div>
                );
              })
            }
          </>
        );
      case SWITCH_TYPES.switch:
        return (
          <label htmlFor={id} className="switch-control">
            <span className="sr-only">On/Off switch</span>
            <input
              id={id}
              type="checkbox"
              className="sr-only"
              onChange={onChange}
              checked={checked}
            />
            <span className="switch-control-slider" />
          </label>
        );
      case SWITCH_TYPES.options:
        return (
          <div className={`options-control ${warningClass}`}>
            {
              options.map((option) => {
                const optionId = `${id}-${nextId()}`;
                return (
                  <div className="options-item" key={`option${nextId()}`}>
                    <input
                      type="radio"
                      name={name}
                      id={optionId}
                      className="sr-only"
                      checked={option.value === checkedName}
                      onChange={onChange}
                      value={option.value}
                    />
                    <label className="options-btn font-weight-medium" htmlFor={optionId}>
                      {option.label}
                    </label>
                  </div>
                );
              })
            }
          </div>
        );
      case SWITCH_TYPES.inline:
        return (
          options.map((option) => {
            const optionId = `${id}-${nextId()}`;
            return (
              <div className="custom-control custom-radio custom-control-inline" key={`option${nextId()}`}>
                <input
                  type="radio"
                  name={name}
                  id={optionId}
                  className="custom-control-input"
                  checked={option.value === checkedName}
                  onChange={onChange}
                  value={option.value}
                />
                <label className="custom-control-label font-weight-medium" htmlFor={optionId}>
                  {option.label}
                </label>
              </div>
            );
          })
        );
      default:
        return null;
    }
  }
}
