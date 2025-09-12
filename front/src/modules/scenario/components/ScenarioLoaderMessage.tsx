import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { Loader } from 'common/Loaders';

export default function ScenarioLoaderMessage() {
  const { t } = useTranslation('operational-studies');

  const { workerStatus } = useScenarioContext();

  if (workerStatus === 'ERROR') {
    return (
      <h1 className="text-center">{t('simulationResults.errorMessages.errorLoadingInfra')}</h1>
    );
  }

  if (workerStatus !== 'READY') {
    return (
      <Loader
        msg={t('simulationResults.infraLoading')}
        className="scenario-loader"
        childClass="scenario-loader-msg"
      />
    );
  }

  return null;
}
