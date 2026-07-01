import { Alert, Info, Blocked, X } from '@osrd-project/ui-icons';

type BannerType = 'warning' | 'error' | 'info';

type BannerProps = {
  type?: BannerType;
  message?: string;
  onClose?: () => void;
};

const iconByType = {
  warning: <Alert variant="fill" size="lg" className="banner-icon warning" />,
  error: <Blocked size="lg" variant="fill" className="banner-icon error" />,
  info: <Info variant="fill" size="lg" className="banner-icon info" />,
};

const Banner = ({ type = 'warning', message, onClose }: BannerProps) => {
  const icon = iconByType[type];

  return (
    <div className={`banner ${type}`}>
      {icon}
      <span className={`banner-text ${type}`}>{message}</span>
      {onClose && (
        <button className={`banner-close-button ${type}`} onClick={onClose} type="button">
          <X />
        </button>
      )}
    </div>
  );
};

export default Banner;
