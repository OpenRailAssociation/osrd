import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isEmpty } from 'lodash';
import icon from 'assets/pictures/components/speedometer.svg';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import cx from 'classnames';
import 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector.scss';

type SpeedLimitByTagSelectorProps = {
  condensed?: boolean;
  selectedSpeedLimitByTag?: string;
  speedLimitsByTags: string[];
  dispatchUpdateSpeedLimitByTag: (newTag: string) => void;
};

export default function SpeedLimitByTagSelector({
  condensed = false,
  selectedSpeedLimitByTag: speedLimitByTag,
  speedLimitsByTags,
  dispatchUpdateSpeedLimitByTag,
}: SpeedLimitByTagSelectorProps) {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const speedLimitsTagsList = useMemo(
    () =>
      !isEmpty(speedLimitsByTags)
        ? [t('noSpeedLimitByTag'), ...Object.values(speedLimitsByTags)]
        : [],
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
          withSearch
          dataTestId="speed-limit-by-tag-selector"
          value={speedLimitByTag || t('noSpeedLimitByTag').toString()}
          options={speedLimitsTagsList}
          onChange={(e) => {
            if (e) dispatchUpdateSpeedLimitByTag(e);
          }}
        />
      </div>
    </div>
  );
}
