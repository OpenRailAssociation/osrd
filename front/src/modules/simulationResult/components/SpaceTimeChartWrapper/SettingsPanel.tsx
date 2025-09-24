import { type ChangeEvent } from 'react';

import { Checkbox, RadioGroup } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { updateProjectionType } from 'reducers/simulationResults';
import { getProjectionType } from 'reducers/simulationResults/selectors';
import type { ProjectionType } from 'reducers/simulationResults/types';
import { useAppDispatch } from 'store';

type Settings = {
  showConflicts: boolean;
  showSignalsStates: boolean;
};

type SettingsPanelProps = {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
  isTimetableItemValid: boolean;
};

const SettingsPanel = ({
  settings,
  onChange,
  onClose,
  isTimetableItemValid,
}: SettingsPanelProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'simulationResults' });
  const dispatch = useAppDispatch();
  const projectionType = useSelector(getProjectionType);

  const handleChange = (key: keyof Settings) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...settings, [key]: event.target.checked });
  };

  return (
    <div className="settings-panel" data-testid="settings-panel">
      <button
        type="button"
        className="close-btn"
        onClick={onClose}
        data-testid="settings-panel-close-button"
      >
        <X />
      </button>

      <section className="pb-3">
        <RadioGroup
          label={t('timeSpaceChartSettings.projection')}
          value={projectionType}
          onChange={(value) => dispatch(updateProjectionType(value as ProjectionType))}
          disabled={!isTimetableItemValid}
          options={[
            {
              label: t('timeSpaceChartSettings.trackProjection'),
              value: 'trackProjection',
            },
            {
              label: t('timeSpaceChartSettings.operationalPointProjection'),
              value: 'operationalPointProjection',
            },
          ]}
        />
      </section>

      <section className="pb-4">
        <header>{t('timeSpaceChartSettings.capacity')}</header>
        <Checkbox
          label={t('timeSpaceChartSettings.signalsStates')}
          checked={settings.showSignalsStates}
          onChange={handleChange('showSignalsStates')}
        />
      </section>

      <section>
        <header>{t('timeSpaceChartSettings.paths')}</header>
        <Checkbox
          label={t('timeSpaceChartSettings.conflicts')}
          checked={settings.showConflicts}
          onChange={handleChange('showConflicts')}
        />
      </section>
    </div>
  );
};

export default SettingsPanel;
