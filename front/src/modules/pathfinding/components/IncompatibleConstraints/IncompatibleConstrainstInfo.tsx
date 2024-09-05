import { type HTMLAttributes } from 'react';

import { Info } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import Tipped from 'common/Tipped';

const IncompatibleConstraintsInfo = (props: HTMLAttributes<unknown>) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  return (
    <Tipped mode="left" {...props}>
      <Info />
      <div style={{ width: 'calc(200px - 1em)' }}>{t('incompatibleConstraints.info')}</div>
    </Tipped>
  );
};

export default IncompatibleConstraintsInfo;
