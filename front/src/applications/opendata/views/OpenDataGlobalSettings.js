import React, { useState } from 'react';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getInfraID, getRollingStockID, getTimetableID } from 'reducers/osrdconf/selectors';

function OpenDataGlobalSettings() {
  const infraID = useSelector(getInfraID);
  const rollingStockID = useSelector(getRollingStockID);
  const timetableID = useSelector(getTimetableID);
  const [showGlobalSettings, setShowGlobalSettings] = useState(
    !infraID || !timetableID || !rollingStockID
  );
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
      <div
        className={`opendata-import-global-settings-items ${showGlobalSettings ? 'active' : ''}`}
      >
        <RollingStockSelector />
      </div>
    </div>
  );
}
export default React.memo(OpenDataGlobalSettings);
