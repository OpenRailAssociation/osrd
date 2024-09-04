import { Tools } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

const StdcmEmptyConfigError = () => {
  const { t } = useTranslation('stdcm');
  return (
    <div className="stdcm-config-error">
      <span className="icon">
        <Tools size="lg" />
      </span>
      <h2 className="mx-0">{t('noConfigurationFound.title')}</h2>
      <p>{t('noConfigurationFound.text')}</p>
    </div>
  );
};

export default StdcmEmptyConfigError;
