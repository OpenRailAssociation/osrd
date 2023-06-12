import React, { InputHTMLAttributes } from 'react';
import './SwitchSNCF.scss';

export const SWITCH_TYPES = {
  inline: 'inline',
  options: 'options',
  radio: 'radio',
  switch: 'switch',
};

type Props = {
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

export default function SwitchSNCF({
  type,
  options = [],
  onChange,
  checkedName,
  name,
  id,
  checked = true,
  warning = false,
  disabled = false,
}: Props): JSX.Element | null {
  const warningClass = warning ? 'warning' : '';

  switch (type) {
    case SWITCH_TYPES.radio:
      return (
        <>
          {options.map((option) => {
            const optionId = `${id}-${name}`;
            return (
              <div className="custom-control custom-radio" key={`option-${id}-${option.value}`}>
                <input
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
          <span className="switch-control-slider" />
        </label>
      );
    case SWITCH_TYPES.options:
      return (
        <div className={`options-control ${warningClass}`}>
          {options.map((option) => {
            const optionId = `${id}-${name}`;
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
            const optionId = `${id}-${name}`;
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
}
