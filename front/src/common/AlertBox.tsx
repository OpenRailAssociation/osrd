import { useState } from 'react';

import { Alert, Blocked, X } from '@osrd-project/ui-icons';

type AlertType = 'warning' | 'error';

type AlertBoxProps = {
  type?: AlertType;
  message?: string;
  closeable?: boolean;
};

const iconByType = {
  warning: <Alert variant="fill" size="lg" className="alert-box-icon warning" />,
  error: <Blocked size="lg" variant="fill" className="alert-box-icon error" />,
};

const AlertBox = ({ type = 'warning', message, closeable }: AlertBoxProps) => {
  const [visible, setVisible] = useState(true);
  const icon = iconByType[type];

  if (!visible) return null;

  return (
    <div className={`alert-box ${type}`}>
      {icon}
      <span className={`alert-box-text ${type}`}>{message}</span>
      {closeable && (
        <button
          className={`alert-box-close-button ${type}`}
          onClick={() => setVisible(false)}
          type="button"
        >
          <X />
        </button>
      )}
    </div>
  );
};

export default AlertBox;
