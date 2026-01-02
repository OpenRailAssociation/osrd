import React from 'react';

import cx from 'classnames';

import Hint from './Hint';
import InputStatusIcon from './InputStatusIcon';
import Label from './Label';
import StatusMessage, { type StatusWithMessage } from './StatusMessage';

export type FieldWrapperProps = {
  id: string;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  statusWithMessage?: StatusWithMessage;
  statusIconPosition?: 'next-to-field' | 'before-status-message';
  /**
   * Input without any wrapper padding.
   * Should not be used with required or statusWithMessage with no tooltip.
   */
  narrow?: boolean;
  small?: boolean;
  children?: React.ReactNode;
  className?: string;
  onCloseStatusMessage?: () => void;
};

const FieldWrapper = ({
  id,
  label,
  hint,
  required,
  disabled,
  statusWithMessage,
  statusIconPosition = 'next-to-field',
  narrow = false,
  small = false,
  className,
  children,
  onCloseStatusMessage,
}: FieldWrapperProps) => {
  const statusClassname = statusWithMessage ? { [statusWithMessage.status]: true } : {};
  const defaultTooltip: StatusWithMessage['tooltip'] = narrow ? 'left' : undefined;

  if (narrow && required) {
    throw new Error('narrow should not be used with required for now. This breaks the input UI.');
  }

  return (
    <div className={cx('ui-feedback', statusClassname, className, { small, narrow })}>
      <div className="custom-field">
        {/* LABEL AND HINT */}
        {label && (
          <Label
            htmlFor={id}
            text={label}
            required={required}
            hasHint={Boolean(hint)}
            disabled={disabled}
            small={small}
          />
        )}
        {hint && <Hint text={hint} />}

        {/* FIELD WRAPPER AND STATUS ICON */}
        <div className="field-and-status-icon">
          {children}
          {statusWithMessage && statusIconPosition === 'next-to-field' && (
            <InputStatusIcon
              status={statusWithMessage.status}
              small={small}
              className="next-to-field"
            />
          )}
        </div>

        {/* STATUS MESSAGE */}
        {statusWithMessage && (
          <StatusMessage
            testIdPrefix="status-message"
            small={small}
            statusWithMessage={{
              ...statusWithMessage,
              tooltip: statusWithMessage?.tooltip ?? defaultTooltip,
            }}
            showIcon={statusIconPosition === 'before-status-message'}
            onClose={onCloseStatusMessage}
          />
        )}
      </div>
    </div>
  );
};

export default FieldWrapper;
