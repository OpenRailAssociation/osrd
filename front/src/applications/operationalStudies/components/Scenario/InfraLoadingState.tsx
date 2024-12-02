import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { InfraWithState } from 'common/api/osrdEditoastApi';

const STEPS = [
  'INITIALIZING',
  'DOWNLOADING',
  'PARSING_JSON',
  'PARSING_INFRA',
  'LOADING_SIGNALS',
  'BUILDING_BLOCKS',
  'CACHED',
];

type Props = {
  infra: InfraWithState;
};

export default function InfraLoadingState({ infra }: Props) {
  const { t } = useTranslation('operationalStudies/scenario');

  return (
    <div
      className={cx(
        'infra-loading-state',
        infra.state === 'CACHED' ? 'cached' : infra.state === 'ERROR' ? 'loading' : 'loading'
      )}
      title={infra.state}
    >
      {infra.state === 'CACHED' ? (
        <span className="infra-loaded" />
      ) : infra.state === 'ERROR' ? (
        <span className="infra-broken" />
      ) : (
        <>
          <span className="infra-loader">•</span>
          <span className="infra-loader">•</span>
          <span className="infra-loader">•</span>
          <div className="steps">
            {t('infraLoadingState', { step: STEPS.indexOf(infra.state) + 1 })}
          </div>
        </>
      )}
    </div>
  );
}
