import { useState } from 'react';

import { Alert, Info, Blocked, X } from '@osrd-project/ui-icons';

type BannerType = 'warning' | 'error' | 'info';

type BannerProps = {
  type?: BannerType;
  message?: string;
  closeable?: boolean;
};

const iconByType = {
  warning: <Alert variant="fill" size="lg" className="banner-icon warning" />,
  error: <Blocked size="lg" variant="fill" className="banner-icon error" />,
  info: <Info variant="fill" size="lg" className="banner-icon info" />,
};

const Banner = ({ type = 'warning', message, closeable }: BannerProps) => {
  const [visible, setVisible] = useState(true);
  const icon = iconByType[type];

  if (!visible) return null;

  return (
    <div className={`banner ${type}`}>
      {icon}
      <span className={`banner-text ${type}`}>{message}</span>
      {closeable && (
        <button
          className={`banner-close-button ${type}`}
          onClick={() => setVisible(false)}
          type="button"
        >
          <X />
        </button>
      )}
    </div>
  );
};

export default Banner;
