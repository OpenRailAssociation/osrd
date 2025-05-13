import { useTranslation } from 'react-i18next';

import type { InfraState } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';

type Props = {
  infraState?: InfraState;
};

export default function ScenarioLoaderMessage({ infraState }: Props) {
  const { t } = useTranslation('operational-studies');

  if (infraState === 'ERROR' || infraState === 'TRANSIENT_ERROR') {
    return (
      <h1 className="text-center">{t('simulationResults.errorMessages.errorLoadingInfra')}</h1>
    );
  }

  if (infraState !== 'CACHED') {
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
