import React, { useState } from 'react';
import InfraSelector from 'applications/osrd/views/OSRDConfig/InfraSelector';
import RollingStockSelector from 'applications/osrd/views/OSRDConfig/RollingStockSelector';
import TimetableSelector from 'applications/osrd/views/OSRDConfig/TimetableSelector';
import { useTranslation } from 'react-i18next';

function OpenDataGlobalSettings() {
  const [mustUpdateTimetable, setMustUpdateTimetable] = useState(true);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const { t } = useTranslation(['opendata']);

  return (
    <div className="opendata-import-global-settings">
      <div
        className="opendata-import-global-settings-bar"
        role="button"
        tabIndex={0}
        onClick={() => setShowGlobalSettings(!showGlobalSettings)}
      >
        {showGlobalSettings ? (
          <>
            {t('closeOSRDConfig')}
            <i className="icons-arrow-up ml-2" />
          </>
        ) : (
          <>
            {t('openOSRDConfig')}
            <i className="icons-arrow-down ml-2" />
          </>
        )}
      </div>
      <div className={`opendata-import-global-settings-items ${showGlobalSettings ? 'active' : ''}`}>
        <div className="row">
          <div className="col-6">
            <InfraSelector />
            <RollingStockSelector />
          </div>
          <div className="col-6">
            <TimetableSelector
              mustUpdateTimetable={mustUpdateTimetable}
              setMustUpdateTimetable={setMustUpdateTimetable}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
export default React.memo(OpenDataGlobalSettings);
