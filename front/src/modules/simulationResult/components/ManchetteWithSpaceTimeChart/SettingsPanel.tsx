import { type ChangeEvent } from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { X } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

type Settings = {
  showConflicts: boolean;
};

type SettingsPanelProps = {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
};

const SettingsPanel = ({ settings, onChange, onClose }: SettingsPanelProps) => {
  const { t } = useTranslation('simulation');

  const handleConflictsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...settings, showConflicts: event.target.checked });
  };

  return (
    <div className="settings-panel">
      <button type="button" className="close-btn" onClick={onClose}>
        <X />
      </button>

      <section>
        <header>{t('timeSpaceChartSettings.paths')}</header>
        <Checkbox
          label={t('timeSpaceChartSettings.conflicts')}
          checked={settings.showConflicts}
          onChange={handleConflictsChange}
        />
      </section>
    </div>
  );
};

export default SettingsPanel;
