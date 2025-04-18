import React from 'react';

import { X } from '@osrd-project/ui-icons';
import cx from 'classnames';

import InputStatusIcon from './InputStatusIcon';

export type Status = 'success' | 'info' | 'error' | 'warning' | 'loading';
export type TooltipType = 'left' | 'right';

export type StatusWithMessage = {
  tooltip?: TooltipType;
  status: Status;
  message?: string;
};

export type StatusMessageProps = {
  statusWithMessage: StatusWithMessage;
  showIcon?: boolean;
  small?: boolean;
  onClose?: () => void;
  testIdPrefix?: string;
};

const StatusMessage = ({
  statusWithMessage,
  showIcon,
  small,
  onClose,
  testIdPrefix,
}: StatusMessageProps) => {
  const { tooltip, status, message } = statusWithMessage;
  if (message === undefined) return null;

  return (
    <div
      className={cx({
        'ui-status-message-wrapper': !tooltip,
        'ui-status-message-wrapper-tooltip': tooltip,
        'tooltip-left': tooltip === 'left',
        'tooltip-right': tooltip === 'right',
        [status]: status,
      })}
    >
      {showIcon && <InputStatusIcon status={status} small={small} />}
      <span
        data-testid={testIdPrefix ? `${testIdPrefix}-${status}` : undefined}
        className={cx('status-message', { [status]: status })}
      >
        {message}
      </span>
      {status === 'info' && tooltip && (
        <button className="status-close" onClick={onClose}>
          <X size="sm" />
        </button>
      )}
    </div>
  );
};

export default StatusMessage;
