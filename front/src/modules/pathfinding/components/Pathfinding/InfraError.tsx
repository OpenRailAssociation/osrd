import { Stop } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

export const InfraSoftError = ({ reloadCount }: { reloadCount: number }) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  return (
    <div className="content pathfinding-error my-2">
      <span className="lead">
        <Stop />
      </span>
      {reloadCount <= 5 ? (
        <span className="flex-grow-1">{t('errorMessages.unableToLoadInfra', { reloadCount })}</span>
      ) : (
        <span className="flex-grow-1">{t('errorMessages.softErrorInfra')}</span>
      )}
    </div>
  );
};

export const InfraHardError = () => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  return (
    <div className="content pathfinding-error my-2">
      <span className="lead">
        <Stop />
      </span>
      <span className="flex-grow-1">{t('errorMessages.hardErrorInfra')}</span>
    </div>
  );
};
