import { useTranslation } from 'react-i18next';

import ScenarioExplorer from 'modules/scenario/components/ScenarioExplorer';
import StdcmAllowances from 'modules/stdcmAllowances/components/StdcmAllowances';

import StdcmCard from './StdcmCard';

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
  return (
    <StdcmCard name={t('debug.simulationSettings')} disabled={disabled}>
      <div className="d-flex">
        <div className="stdcm-scenario-explorer">
          <ScenarioExplorer
            globalProjectId={projectID}
            globalStudyId={studyID}
            globalScenarioId={scenarioID}
            displayImgProject={false}
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
