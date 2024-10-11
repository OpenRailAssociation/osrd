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
    <div id="settings-panel" className="flex justify-end absolute">
      <div className="settings-panel-section">
        <div className="settings-panel-section-title">{t('timeSpaceChartSettings.paths')}</div>
        <div className="selection">
          <Checkbox
            label={t('timeSpaceChartSettings.conflicts')}
            checked={settings.showConflicts}
            onChange={handleConflictsChange}
          />
        </div>
      </div>
      <button type="button" id="close-settings-panel" onClick={onClose}>
        <X />
      </button>
    </div>
  );
};

export default SettingsPanel;
