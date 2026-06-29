import { Select } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { createStandardSelectOptions } from 'utils/uiCoreHelpers';

type SpeedLimitTagSelectorProps = {
  condensed?: boolean;
  disabled?: boolean;
  selectedSpeedLimitTag?: string;
  speedLimitTags: string[];
  updateSpeedLimitTag: (newTag: string | null) => void;
  className?: string;
  showPlaceHolder?: boolean;
  narrow?: boolean;
};

const SpeedLimitTagSelector = ({
  condensed = false,
  disabled = false,
  selectedSpeedLimitTag: speedLimitTag,
  speedLimitTags,
  updateSpeedLimitTag,
  className = '',
  showPlaceHolder = false,
  narrow = false,
}: SpeedLimitTagSelectorProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });

  if (!speedLimitTags.length) return null;
  return (
    <div className="osrd-config-item">
      <div
        className={cx('osrd-config-item-container', className, {
          'd-flex align-items-center gap-10': condensed,
        })}
      >
        <Select
          disabled={disabled}
          id="speed-limit-by-tag-selector"
          data-testid="speed-limit-by-tag-selector"
          value={speedLimitTag || ''}
          label={t('speedLimitByTagAbbrev')}
          // The placeHolder is only displayed in operationalStudies and in debug mode in stdcm
          placeholder={showPlaceHolder ? t('noSpeedLimitByTag') : undefined}
          onChange={(e) => {
            if (e) {
              updateSpeedLimitTag(e);
            } else {
              updateSpeedLimitTag(null);
            }
          }}
          {...createStandardSelectOptions(speedLimitTags)}
          narrow={narrow}
        />
      </div>
    </div>
  );
};

export default SpeedLimitTagSelector;
