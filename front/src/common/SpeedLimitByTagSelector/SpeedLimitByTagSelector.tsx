import { useMemo } from 'react';

import { Select } from '@osrd-project/ui-core';
import cx from 'classnames';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import { createStringSelectOptions } from 'utils/uiCoreHelpers';

type SpeedLimitByTagSelectorProps = {
  condensed?: boolean;
  disabled?: boolean;
  selectedSpeedLimitByTag?: string;
  speedLimitsByTags: string[];
  dispatchUpdateSpeedLimitByTag: (newTag: string | null) => void;
};

export default function SpeedLimitByTagSelector({
  condensed = false,
  disabled = false,
  selectedSpeedLimitByTag: speedLimitByTag,
  speedLimitsByTags,
  dispatchUpdateSpeedLimitByTag,
}: SpeedLimitByTagSelectorProps) {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const speedLimitsTagsList = useMemo(
    () => (!isEmpty(speedLimitsByTags) ? speedLimitsByTags : []),
    [speedLimitsByTags]
  );

  if (!speedLimitsTagsList.length) return null;

  return (
    <div className="osrd-config-item mb-2">
      <div
        className={cx('osrd-config-item-container', {
          'd-flex align-items-center gap-10': condensed,
        })}
      >
        <Select
          disabled={disabled}
          id="speed-limit-by-tag-selector"
          value={speedLimitByTag || ''}
          label={t('speedLimitByTagAbbrev')}
          placeholder={t('noSpeedLimitByTag')}
          onChange={(e) => {
            if (e) {
              dispatchUpdateSpeedLimitByTag(e);
            } else {
              dispatchUpdateSpeedLimitByTag(null);
            }
          }}
          {...createStringSelectOptions(speedLimitsTagsList)}
        />
      </div>
    </div>
  );
}
