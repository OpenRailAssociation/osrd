import { useCallback, type HTMLAttributes } from 'react';

import { Filter } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { FiltersConstrainstState, IncompatibleConstraintType } from './types';
import { getIcon, getSizeOfEnabledFilters } from './utils';

interface IncompatibleConstraintsFiltersProps extends HTMLAttributes<unknown> {
  data: FiltersConstrainstState;
  toggleFilter: (type: string) => void;
}

const IncompatibleConstraintsFilters = (props: IncompatibleConstraintsFiltersProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { data, toggleFilter, ...htmlAttrs } = props;

  const getTitle = useCallback(
    (label: string, enabled: boolean) => {
      const allSelected = Object.entries(data).every(([, e]) => e.enabled);
      if (allSelected) {
        return t('incompatibleConstraints.filters.focus', { name: label });
      }

      if (getSizeOfEnabledFilters(data) === 1) {
        return t('incompatibleConstraints.filters.activateAll');
      }

      return enabled
        ? t('incompatibleConstraints.filters.disable', { name: label })
        : t('incompatibleConstraints.filters.enable', { name: label });
    },
    [t, data]
  );

  return (
    <div {...htmlAttrs}>
      <Filter title={t('incompatibleConstraints.filters.title')} />
      {Object.entries(data).map(([name, type]) => {
        const Icon = getIcon(name as IncompatibleConstraintType);
        const label = t(`incompatibleConstraints.${name}`).toString();
        return (
          <button
            key={name}
            type="button"
            title={getTitle(label, type.enabled)}
            className={cx('ml-2', type.enabled ? 'text-danger' : 'text-muted')}
            onClick={() => toggleFilter(name)}
          >
            <Icon />({type.count})
          </button>
        );
      })}
    </div>
  );
};

export default IncompatibleConstraintsFilters;
