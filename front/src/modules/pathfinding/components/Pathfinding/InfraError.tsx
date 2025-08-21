import { Stop } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

const InfraError = () => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  return (
    <div className="content pathfinding-error my-2">
      <span className="lead">
        <Stop />
      </span>
      <span className="flex-grow-1">{t('errorMessages.hardErrorInfra')}</span>
    </div>
  );
};

export default InfraError;
