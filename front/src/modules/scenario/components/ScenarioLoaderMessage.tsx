import { useTranslation } from 'react-i18next';

import type { InfraState } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';

type Props = {
  infraState?: InfraState;
};

export default function ScenarioLoaderMessage({ infraState }: Props) {
  const { t } = useTranslation(['translation', 'simulation', 'allowances']);

  if (infraState === 'ERROR' || infraState === 'TRANSIENT_ERROR' || infraState === 'INITIALIZING') {
    return <h1 className="text-center">{t('simulation:errorMessages.errorLoadingInfra')}</h1>;
  }

  if (infraState !== 'CACHED') {
    return (
      <Loader
        msg={t('simulation:infraLoading')}
        className="scenario-loader"
        childClass="scenario-loader-msg"
      />
    );
  }

  return null;
}
