import { type ChangeEvent } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

type Settings = {
  showConflicts: boolean;
  showBAL: boolean;
  showBAPR: boolean;
  showTVM: boolean;
  showSignalsStates: boolean;
};

type SettingsPanelProps = {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
};

const SettingsPanel = ({ settings, onChange, onClose }: SettingsPanelProps) => {
  const { t } = useTranslation('simulation');

  const handleChange = (key: keyof Settings) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...settings, [key]: event.target.checked });
  };

  return (
    <div className="settings-panel">
      <button type="button" className="close-btn" onClick={onClose}>
        <X />
      </button>

      <section>
        <header>{t('timeSpaceChartSettings.capacity')}</header>
        <Checkbox
          label={t('timeSpaceChartSettings.signals.BAL')}
          checked={settings.showBAL}
          onChange={handleChange('showBAL')}
        />
        <Checkbox
          label={t('timeSpaceChartSettings.signals.BAPR')}
          checked={settings.showBAPR}
          onChange={handleChange('showBAPR')}
        />
        <Checkbox
          label={t('timeSpaceChartSettings.signals.TVM')}
          checked={settings.showTVM}
          onChange={handleChange('showTVM')}
        />
        <Checkbox
          label={t('timeSpaceChartSettings.signals.signalsStates')}
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
