import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { Distribution } from 'common/api/osrdEditoastApi';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { useOsrdConfActions } from 'common/osrdContext';
import { useAppDispatch } from 'store';

type Props = {
  constraintDistribution: Distribution;
};
const ConstraintDistributionSwitch = ({ constraintDistribution }: Props) => {
  const { updateConstraintDistribution } = useOsrdConfActions();
  const dispatch = useAppDispatch();
  const [constraint, setConstraint] = useState(constraintDistribution);
  const { t } = useTranslation(['operationalStudies/allowances', 'translation']);

  useEffect(() => {
    dispatch(updateConstraintDistribution(constraint));
  }, [constraint]);

  const distributionsList = useMemo(
    () => [
      {
        label: (
          <>
            <span className="bullet-linear">●</span>
            {t('operationalStudies/allowances:distribution.linear')}
          </>
        ),
        value: 'STANDARD',
      },
      {
        label: (
          <>
            <span className="bullet-mareco">●</span>
            {t('operationalStudies/allowances:distribution.mareco')}
          </>
        ),
        value: 'MARECO',
      },
    ],
    [t]
  );

  return (
    <div className="osrd-config-item-container d-flex align-items-center mb-2">
      <span className="mr-2 text-muted">{t('standardAllowance')}</span>
      <OptionsSNCF
        name="constraint-distribution-switch"
        onChange={(e) => setConstraint(e.target.value as Distribution)}
        selectedValue={constraint}
        options={distributionsList}
      />
    </div>
  );
};

export default ConstraintDistributionSwitch;
