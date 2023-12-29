import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from 'reducers';
import { Infra } from 'common/api/osrdEditoastApi';
import { useTranslation } from 'react-i18next';
import { Loader } from 'common/Loaders';

type Props = {
  infraState?: Infra['state'];
};

export default function ScenarioLoaderMessage({ infraState }: Props) {
  const { t } = useTranslation(['translation', 'simulation', 'allowances']);
  const isUpdating = useSelector((state: RootState) => state.osrdsimulation.isUpdating);
  if (infraState === 'ERROR' || infraState === 'TRANSIENT_ERROR') {
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
  if (isUpdating) {
    return (
      <Loader
        msg={t('simulation:isUpdating')}
        className="scenario-loader"
        childClass="scenario-loader-msg"
      />
    );
  }
  return null;
}
