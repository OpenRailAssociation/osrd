import React from 'react';

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
        infra.state && infra.state === 'CACHED' ? 'cached' : 'loading'
      )}
      title={infra.state}
    >
      {infra.state && infra.state === 'CACHED' ? (
        <span>•</span>
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
