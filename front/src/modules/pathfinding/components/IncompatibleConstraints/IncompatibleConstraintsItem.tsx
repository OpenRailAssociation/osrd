import React, { type FC } from 'react';

import { Location } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';

import { distanceToHumanReadable } from 'utils/strings';

import type { IncompatibleConstraintItemEnhanced } from './type';
import { getIcon } from './utils';

interface IncompatibleConstraintItemProps {
  data: IncompatibleConstraintItemEnhanced;
  onHover: () => void;
  onClick: () => void;
  gotoMap: () => void;
  highlighted?: boolean;
}

const IncompatibleConstraintItem: FC<IncompatibleConstraintItemProps> = ({
  data,
  onHover,
  onClick,
  gotoMap,
}) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const Icon = getIcon(data.type);
  return (
    <div
      className={cx(
        'incompatible-constraints-item d-flex justify-content-around align-items-center my-2 rounded py-1',
        data.highlighted ? 'bg-success' : 'bg-light'
      )}
      onMouseOver={onHover}
      onFocus={onHover}
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
            size="1.5em"
            title={t(`incompatibleConstraints.${data.type}`)}
          />
        </div>
        <div className="flex-grow-1 flex-shrink-1 text-left ml-1">
          {distanceToHumanReadable(data.range.start)} (
          {distanceToHumanReadable(data.range.end - data.range.start)})
          {'value' in data && !isNil(data.value) && <> - {data.value}</>}
        </div>
      </button>
      <div className="flex-grow-0 flex-shrink-0 mr-2">
        <button type="button" title={t('incompatibleConstraints.gotoMap')} onClick={gotoMap}>
          <Location />
          <span className="sr-only">{t('incompatibleConstraints.gotoMap')}</span>
        </button>
      </div>
    </div>
  );
};

export default IncompatibleConstraintItem;
