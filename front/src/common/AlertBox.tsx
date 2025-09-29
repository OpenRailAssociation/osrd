import { useState } from 'react';

import { Alert, X } from '@osrd-project/ui-icons';

type AlertType = 'warning';

type AlertBoxProps = {
  type?: AlertType;
  message?: string;
  closeable?: boolean;
};

const iconByType = {
  warning: <Alert variant="fill" size="lg" className="alert-box__icon--warning" />,
};

const AlertBox = ({ type = 'warning', message, closeable }: AlertBoxProps) => {
  const [visible, setVisible] = useState(true);
  const icon = iconByType[type];

  if (!visible) return null;

  return (
    <div className={`alert-box alert-box--${type}`}>
      {icon}
      <span className={`alert-box__text--${type}`}>{message}</span>
      {closeable && (
        <button className="alert-box__close-button" onClick={() => setVisible(false)} type="button">
          <X />
        </button>
      )}
    </div>
  );
};

export default AlertBox;
