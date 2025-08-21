import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { Loader } from 'common/Loaders';

export default function ScenarioLoaderMessage() {
  const { t } = useTranslation('operational-studies');

  const { infra } = useScenarioContext();

  if (infra.status === 'ERROR') {
    return (
      <h1 className="text-center">{t('simulationResults.errorMessages.errorLoadingInfra')}</h1>
    );
  }

  if (infra.status !== 'READY') {
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
