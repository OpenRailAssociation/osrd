import React, { type FC, type InputHTMLAttributes } from 'react';

import cx from 'classnames';

export const SWITCH_TYPES = {
  inline: 'inline',
  options: 'options',
  radio: 'radio',
  switch: 'switch',
};

export type SwitchSNCFProps = {
  type: string;
  onChange: InputHTMLAttributes<HTMLInputElement>['onChange'];
  options?: { label: string; value: string }[];
  checkedName?: string;
  name: string;
  id: string;
  checked?: boolean;
  warning?: boolean;
  disabled?: boolean;
};

const SwitchSNCF: FC<SwitchSNCFProps> = ({
  type,
  options = [],
  onChange,
  checkedName,
  name,
  id,
  checked = true,
  warning,
  disabled,
}) => {
  switch (type) {
    case SWITCH_TYPES.radio:
      return (
        <>
          {options.map((option) => {
            const optionId = `${id}-${name}-${option.value}`;
            return (
              <div className="custom-control custom-radio" key={`option-${id}-${option.value}`}>
                <input
                  data-testid={optionId}
                  type="radio"
                  id={optionId}
                  name={name}
                  className="custom-control-input"
                  checked={checked}
                  onChange={onChange}
                  value={option.value}
                />
                <label className="custom-control-label font-weight-medium" htmlFor={optionId}>
                  {option.label}
                </label>
              </div>
            );
          })}
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
            disabled={disabled}
          />
          <span data-testid={name} className="switch-control-slider" />
        </label>
      );
    case SWITCH_TYPES.options:
      return (
        <div className={cx('options-control', { warning })}>
          {options.map((option) => {
            const optionId = `${id}-${name}-${option.value}`;
            return (
              <div className="options-item" key={`option-${id}-${option.value}`}>
                <input
                  type="radio"
                  name={name}
                  id={optionId}
                  className="sr-only"
                  checked={option.value === checkedName}
                  onChange={onChange}
                  value={option.value}
                  disabled={disabled}
                />
                <label className="options-btn font-weight-medium" htmlFor={optionId}>
                  {option.label}
                </label>
              </div>
            );
          })}
        </div>
      );
    case SWITCH_TYPES.inline:
      return (
        <>
          {options.map((option) => {
            const optionId = `${id}-${name}-${option.value}`;
            return (
              <div
                className="custom-control custom-radio custom-control-inline"
                key={`option-${id}-${option.value}`}
              >
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
          })}
        </>
      );
    default:
      return null;
  }
};

export default SwitchSNCF;
