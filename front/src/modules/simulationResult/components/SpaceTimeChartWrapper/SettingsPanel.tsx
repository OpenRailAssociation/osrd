import { type ChangeEvent } from 'react';

import { Checkbox, RadioGroup } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { toggleSimulationEnabled, updateProjectionType } from 'reducers/simulationResults';
import { getProjectionType, getIsSimulationEnabled } from 'reducers/simulationResults/selectors';
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
  isTrainScheduleValid: boolean;
};

const SettingsPanel = ({
  settings,
  onChange,
  onClose,
  isTrainScheduleValid,
}: SettingsPanelProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'simulationResults' });
  const dispatch = useAppDispatch();
  const projectionType = useSelector(getProjectionType);
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);

  const handleChange = (key: keyof Settings) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...settings, [key]: event.target.checked });
  };

  const handleUseSimulationChange = () => {
    dispatch(toggleSimulationEnabled());
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
          disabled={!isTrainScheduleValid || !isSimulationEnabled}
          options={[
            {
              label: t('timeSpaceChartSettings.operationalPointProjection'),
              value: 'operationalPointProjection',
            },
            {
              label: t('timeSpaceChartSettings.trackProjection'),
              value: 'trackProjection',
            },
          ]}
        />
        <Checkbox
          label={t('timeSpaceChartSettings.inputMode')}
          checked={!isSimulationEnabled}
          onChange={handleUseSimulationChange}
        />
      </section>

      <section className="pb-4">
        <header>{t('timeSpaceChartSettings.capacity')}</header>
        <Checkbox
          label={t('timeSpaceChartSettings.signalsStates')}
          checked={settings.showSignalsStates}
          onChange={handleChange('showSignalsStates')}
          disabled={!isSimulationEnabled}
        />
      </section>

      <section>
        <header>{t('timeSpaceChartSettings.paths')}</header>
        <Checkbox
          label={t('timeSpaceChartSettings.conflicts')}
          checked={settings.showConflicts}
          onChange={handleChange('showConflicts')}
          disabled={!isSimulationEnabled}
        />
      </section>
    </div>
  );
};

export default SettingsPanel;
