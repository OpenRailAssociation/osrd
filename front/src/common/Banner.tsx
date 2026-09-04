import { Alert, Info, Blocked, X } from '@osrd-project/ui-icons';

type BannerType = 'warning' | 'error' | 'info';

type BannerProps = {
  type?: BannerType;
  message?: string;
  onClose?: () => void;
  dataTestId?: string;
};

const iconByType = {
  warning: <Alert variant="fill" size="lg" className="banner-icon warning" />,
  error: <Blocked size="lg" variant="fill" className="banner-icon error" />,
  info: <Info variant="fill" size="lg" className="banner-icon info" />,
};

const Banner = ({ type = 'warning', message, onClose, dataTestId }: BannerProps) => {
  const icon = iconByType[type];

  return (
    <div className={`banner ${type}`} data-testid={dataTestId}>
      {icon}
      <span className={`banner-text ${type}`} data-testid={`banner-text-${type}`}>
        {message}
      </span>
      {onClose && (
        <button
          className={`banner-close-button ${type}`}
          onClick={onClose}
          type="button"
          data-testid={dataTestId ? `${dataTestId}-close-button` : undefined}
        >
          <X />
        </button>
      )}
    </div>
  );
};

export default Banner;
