import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { Distribution } from 'common/api/osrdEditoastApi';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { updateConstraintDistribution } from 'reducers/osrdconf/operationalStudiesConf';
import { useAppDispatch } from 'store';

type Props = {
  constraintDistribution: Distribution;
};
const ConstraintDistributionSwitch = ({ constraintDistribution }: Props) => {
  const dispatch = useAppDispatch();
  const [constraint, setConstraint] = useState(constraintDistribution);
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });

  useEffect(() => {
    dispatch(updateConstraintDistribution(constraint));
  }, [constraint]);

  const distributionsList = useMemo(
    () => [
      {
        label: (
          <>
            <span className="bullet-linear">●</span>
            {t('allowances.distribution-linear')}
          </>
        ),
        value: 'STANDARD',
      },
      {
        label: (
          <>
            <span className="bullet-mareco">●</span>
            {t('allowances.distribution-mareco')}
          </>
        ),
        value: 'MARECO',
      },
    ],
    [t]
  );

  return (
    <div className="toggle-container constraint-distribution-switch">
      <span className="mr-2 text-muted">{t('allowances.standard-allowance')}</span>
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
