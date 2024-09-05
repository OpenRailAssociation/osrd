import { useMemo } from 'react';

import { Location } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';

import { distanceToHumanReadable } from 'utils/strings';

import type { IncompatibleConstraintEnhanced } from './types';
import { getIcon } from './utils';

interface IncompatibleConstraintItemProps {
  data: IncompatibleConstraintEnhanced;
  isHovered?: boolean;
  isSelected?: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
  gotoMap: () => void;
}

const IncompatibleConstraintItem = ({
  data,
  isHovered,
  isSelected,
  onEnter,
  onLeave,
  onClick,
  gotoMap,
}: IncompatibleConstraintItemProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const Icon = getIcon(data.type);
  let bgClass = 'bg-light';
  if (isSelected) bgClass = 'bg-success text-white';
  if (isHovered) bgClass = 'bg-info text-white';

  const value = useMemo(() => {
    if (
      data.type === 'incompatible_electrification_ranges' &&
      !isNil(data.value) &&
      data.value === ''
    ) {
      return t('incompatibleConstraints.noElectrification');
    }
    return 'value' in data && !isNil(data.value) ? data.value : null;
  }, [data, t]);

  return (
    <div
      className={cx(
        'incompatible-constraints-item d-flex justify-content-around align-items-center my-2 rounded py-1 ',
        bgClass
      )}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        className="flex-grow-1 d-flex"
        title={t(`incompatibleConstraints.${data.type}`)}
        onClick={onClick}
      >
        <div className="flex-grow-0 flex-shrink-0 icon">
          <Icon
            className="text-danger"
            size="lg"
            title={t(`incompatibleConstraints.${data.type}`)}
          />
        </div>
        <div className="flex-grow-1 flex-shrink-1 text-left ml-1 d-flex align-items-center">
          {distanceToHumanReadable(data.start)} ({distanceToHumanReadable(data.end - data.start)})
          {!isNil(value) && <> - {value}</>}
        </div>
      </button>
      <button
        className="flex-grow-0 flex-shrink-0 mr-2"
        type="button"
        title={t('incompatibleConstraints.gotoMap')}
        onClick={gotoMap}
      >
        <Location className="d-flex justify-content-around align-items-center" />
        <span className="sr-only">{t('incompatibleConstraints.gotoMap')}</span>
      </button>
    </div>
  );
};

export default IncompatibleConstraintItem;
