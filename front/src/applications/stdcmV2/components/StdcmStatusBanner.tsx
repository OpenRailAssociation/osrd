import cx from 'classnames';
import { useTranslation } from 'react-i18next';

type StdcmStatusBannerProps = {
  isFailed: boolean;
};
const StdcmStatusBanner = ({ isFailed }: StdcmStatusBannerProps) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results.status' });

  return (
    <div className="simulation-status-banner">
      <div className="banner-content">
        <span className={cx('status', { failed: isFailed })}>
          {isFailed ? t('failed') : t('completed')}
        </span>
        {isFailed && <p className="error-message">{t('errorMessage')}</p>}
      </div>
    </div>
  );
};

export default StdcmStatusBanner;
