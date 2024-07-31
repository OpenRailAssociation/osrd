import React from 'react';

import { Alert } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

type ProjectionLoadingMessage = {
  projectedTrainsNb: number;
  totalTrains: number;
};

const ProjectionLoadingMessage = ({ projectedTrainsNb, totalTrains }: ProjectionLoadingMessage) => {
  const { t } = useTranslation('simulation');

  return (
    <div
      style={{ position: 'absolute', left: '50%', top: '10px' }}
      className="d-flex align-items-center"
    >
      <div className="d-flex align-items-center text-warning">
        <Alert />
      </div>
      <span className="ml-2">
        {t('projectionInProgress', {
          count: projectedTrainsNb,
          total: totalTrains,
        })}
      </span>
    </div>
  );
};

export default ProjectionLoadingMessage;
