import React, { type ChangeEvent, useState } from 'react';

import { RequiredInput } from '@osrd-project/ui-icons';
import cx from 'classnames';

import InputStatusIcon from './InputStatusIcon';
import RadioButton, { type RadioButtonProps } from './RadioButton';
import { type StatusWithMessage } from './StatusMessage';

export type RadioGroupProps = {
  label?: string;
  subtitle?: string;
  readOnly?: boolean;
  disabled?: boolean;
  required?: boolean;
  small?: boolean;
  value?: string;
  options: RadioButtonProps[];
  statusWithMessage?: StatusWithMessage;
  onChange?: (value: string) => void;
};

const RadioGroup = ({
  label,
  value,
  subtitle,
  readOnly,
  disabled,
  options,
  statusWithMessage,
  required,
  small,
  onChange,
}: RadioGroupProps) => {
  const [selectedValue, setSelectedValue] = useState<string | undefined>(value);

  const handleOptionChange = (e: ChangeEvent<HTMLInputElement>, nextOption: RadioButtonProps) => {
    if (!readOnly) {
      setSelectedValue(nextOption.value);
      nextOption.onChange?.(e);
      onChange?.(nextOption.value);
    }
  };

  const statusClassname = statusWithMessage?.status ? { [statusWithMessage.status]: true } : {};

  return (
    <div className={cx('ui-radio-button-wrapper', statusClassname)}>
      {label && (
        <label className="label">
          {required && (
            <span className="required">
              <RequiredInput />
            </span>
          )}
          {label} {subtitle && <span className="subtitle">{subtitle}</span>}
        </label>
      )}

      {options.map((option) => (
        <RadioButton
          key={option.value}
          {...option}
          readOnly={readOnly}
          disabled={disabled}
          checked={selectedValue === option.value}
          onChange={(e) => {
            handleOptionChange(e, option);
          }}
          small={small}
        />
      ))}
      {statusWithMessage?.message && (
        <div className="status-with-message">
          <InputStatusIcon status={statusWithMessage.status} />
          <span className={cx('status-message', statusClassname)}>{statusWithMessage.message}</span>
        </div>
      )}
    </div>
  );
};

export default RadioGroup;
