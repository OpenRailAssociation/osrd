import React, { useMemo } from 'react';

import cx from 'classnames';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import icon from 'assets/pictures/components/speedometer.svg';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';

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
        <img width="32px" src={icon} alt="speedometer" />
        <span className="text-muted">{t('speedLimitByTag')}</span>
        <SelectImprovedSNCF
          sm
          disabled={disabled}
          withSearch
          dataTestId="speed-limit-by-tag-selector"
          value={speedLimitByTag || t('noSpeedLimitByTag').toString()}
          options={speedLimitsTagsList}
          onChange={(e) => {
            if (e && e !== t('noSpeedLimitByTag')) {
              dispatchUpdateSpeedLimitByTag(e);
            } else {
              dispatchUpdateSpeedLimitByTag(null);
            }
          }}
        />
      </div>
    </div>
  );
}
