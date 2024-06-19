import React from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useOsrdConfSelectors } from 'common/osrdContext';
import ScenarioExplorer from 'modules/scenario/components/ScenarioExplorer';

const StdcmHeader = () => {
  const { t } = useTranslation('stdcm');
  const { getProjectID, getScenarioID, getStudyID } = useOsrdConfSelectors();
  const studyID = useSelector(getStudyID);
  const projectID = useSelector(getProjectID);
  const scenarioID = useSelector(getScenarioID);

  return (
    <div className="stdcm-v2-header">
      <span className="stdcm-v2-header__title col-3 pl-5">ST DCM</span>
      <span className="stdcm-v2-header__notification" id="notification">
        {t('notificationTitle')}
        {/* <a href="#notification">Plus d’informations</a> */}
      </span>
      <div className="w-25 pr-4">
        <ScenarioExplorer
          globalProjectId={projectID}
          globalStudyId={studyID}
          globalScenarioId={scenarioID}
          displayImgProject={false}
        />
      </div>
    </div>
  );
};

export default StdcmHeader;
