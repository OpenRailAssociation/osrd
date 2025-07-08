import { useMemo } from 'react';

import { Select } from '@osrd-project/ui-core';
import cx from 'classnames';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import { createStandardSelectOptions } from 'utils/uiCoreHelpers';

type SpeedLimitByTagSelectorProps = {
  condensed?: boolean;
  disabled?: boolean;
  selectedSpeedLimitByTag?: string;
  speedLimitsByTags: string[];
  dispatchUpdateSpeedLimitByTag: (newTag: string | null) => void;
  className?: string;
  showPlaceHolder?: boolean;
  narrow?: boolean;
};

export default function SpeedLimitByTagSelector({
  condensed = false,
  disabled = false,
  selectedSpeedLimitByTag: speedLimitByTag,
  speedLimitsByTags,
  dispatchUpdateSpeedLimitByTag,
  className = '',
  showPlaceHolder = false,
  narrow = false,
}: SpeedLimitByTagSelectorProps) {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });

  const speedLimitsTagsList = useMemo(
    () => (!isEmpty(speedLimitsByTags) ? speedLimitsByTags : []),
    [speedLimitsByTags]
  );

  if (!speedLimitsTagsList.length) return null;
  return (
    <div className="osrd-config-item">
      <div
        className={
          (cx('osrd-config-item-container', {
            'd-flex align-items-center gap-10': condensed,
          }),
          className)
        }
      >
        <Select
          disabled={disabled}
          id="speed-limit-by-tag-selector"
          value={speedLimitByTag || ''}
          label={t('speedLimitByTagAbbrev')}
          // The placeHolder is only displayed in operationalStudies and in debug mode in stdcm
          placeholder={showPlaceHolder ? t('noSpeedLimitByTag') : undefined}
          onChange={(e) => {
            if (e) {
              dispatchUpdateSpeedLimitByTag(e);
            } else {
              dispatchUpdateSpeedLimitByTag(null);
            }
          }}
          {...createStandardSelectOptions(speedLimitsTagsList)}
          narrow={narrow}
        />
      </div>
    </div>
  );
}
