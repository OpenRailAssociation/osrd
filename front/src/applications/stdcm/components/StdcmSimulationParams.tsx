import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import ScenarioExplorer from 'modules/scenario/components/ScenarioExplorer';
import StdcmAllowances from 'modules/stdcmAllowances/components/StdcmAllowances';
import { getStdcmTimetableID } from 'reducers/osrdconf/stdcmConf/selectors';

import StdcmCard from './StdcmForm/StdcmCard';

type StdcmSimulationParamsProps = {
  disabled?: boolean;
  projectID: number | undefined;
  studyID: number | undefined;
  scenarioID: number | undefined;
};

const StdcmSimulationParams = ({
  disabled = false,
  projectID,
  studyID,
  scenarioID,
}: StdcmSimulationParamsProps) => {
  const { t } = useTranslation('stdcm');

  const timetableId = useSelector(getStdcmTimetableID);

  return (
    <StdcmCard name={t('debug.simulationSettings')} disabled={disabled}>
      <div className="d-flex stdcm-simulation-params">
        <div className="stdcm-scenario-explorer">
          <ScenarioExplorer
            globalProjectId={projectID}
            globalStudyId={studyID}
            globalScenarioId={scenarioID}
            displayImgProject={false}
            timetableId={timetableId}
          />
        </div>
        <div className="stdcm-allowances ml-2">
          <StdcmAllowances />
        </div>
      </div>
    </StdcmCard>
  );
};

export default StdcmSimulationParams;
