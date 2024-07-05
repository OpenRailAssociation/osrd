import React, { type FC, type HTMLAttributes } from 'react';

import { Filter } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { toPairs } from 'lodash';
import { useTranslation } from 'react-i18next';

import { getIcon } from './utils';

interface IncompatibleConstraintsFiltersProps extends HTMLAttributes<unknown> {
  data: Record<string, { count: number; enabled: boolean }>;
  toggle: (type: string) => void;
}
const IncompatibleConstraintsFilters: FC<IncompatibleConstraintsFiltersProps> = (props) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { data, toggle, ...htmlAttrs } = props;

  return (
    <div {...htmlAttrs}>
      <Filter title={t('incompatibleConstraints.filters.title')} />
      {toPairs(data)
        .filter(([, type]) => type.count > 0)
        .map(([name, type]) => {
          const Icon = getIcon(name);
          const label = t(`incompatibleConstraints.${name}`).toString();
          return (
            <button
              key={name}
              type="button"
              title={
                type.enabled
                  ? t('incompatibleConstraints.filters.disable', { name: label })
                  : t('incompatibleConstraints.filters.enable', { name: label })
              }
              className={cx('ml-2', type.enabled ? 'text-danger' : 'text-muted')}
              onClick={() => toggle(name)}
            >
              <Icon />({type.count})
            </button>
          );
        })}
    </div>
  );
};

export default IncompatibleConstraintsFilters;
