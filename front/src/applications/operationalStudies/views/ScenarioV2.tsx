import { useSelector } from 'react-redux';

import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioQueryParams from 'applications/operationalStudies/hooks/useScenarioQueryParams';
import ScenarioHeader from 'applications/operationalStudies/v2/components/ScenarioHeader';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';
import { getOperationalStudiesInfraID } from 'reducers/osrdconf/operationalStudiesConf/selectors';

import ScenarioContentV2 from '../v2/components/ScenarioContentV2';

const ScenarioV2 = () => {
  const { scenario } = useScenario();

  const infraId = useSelector(getOperationalStudiesInfraID);

  // Initialize and sync the URL and local storage with Redux
  useScenarioQueryParams();

  const infraData = useInfraStatus({ infraId });
  const { infra } = infraData;

  if (!scenario || !infra) return null;

  return (
    <ScenarioContextProvider infraId={infra.id}>
      <ScenarioHeader scenario={scenario} infra={infra} />
      <ScenarioContentV2
        displayTimetable
        displayConflictsList
        displaySpeedSpaceChart
        displayManchetteWithSpaceTimeChart
        displaySimulationResultMap
        displayTimeStopTable
      />
    </ScenarioContextProvider>
  );
};

export default ScenarioV2;
