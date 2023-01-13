import React, { useState } from 'react';
import PropTypes from 'prop-types';
import InfraSelector from 'common/InfraSelector/InfraSelector';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import TimetableSelector from 'applications/operationalStudies/views/OSRDConfig/TimetableSelector';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getInfraID, getRollingStockID, getTimetableID } from 'reducers/osrdconf/selectors';

function OpenDataGlobalSettings(props) {
  const { mustUpdateTimetable, setMustUpdateTimetable } = props;
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

OpenDataGlobalSettings.propTypes = {
  mustUpdateTimetable: PropTypes.bool.isRequired,
  setMustUpdateTimetable: PropTypes.func.isRequired,
};
