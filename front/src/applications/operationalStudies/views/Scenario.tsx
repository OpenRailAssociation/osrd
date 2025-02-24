import { useSelector } from 'react-redux';

import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import ScenarioContent from 'applications/operationalStudies/components/Scenario/ScenarioContent';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioQueryParams from 'applications/operationalStudies/hooks/useScenarioQueryParams';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';
import { getOperationalStudiesInfraID } from 'reducers/osrdconf/operationalStudiesConf/selectors';

const Scenario = () => {
  const { scenario } = useScenario();

  const infraId = useSelector(getOperationalStudiesInfraID);

  // Initialize and sync the URL and local storage with Redux
  useScenarioQueryParams();

  const infraData = useInfraStatus({ infraId });
  const { infra } = infraData;

  if (!scenario || !infra) return null;

  return (
    <ScenarioContextProvider infraId={infra.id}>
      <NavBarSNCF
        appName={
          <BreadCrumbs project={scenario.project} study={scenario.study} scenario={scenario} />
        }
      />
      <ScenarioContent scenario={scenario} infra={infra} infraMetadata={infraData} />
    </ScenarioContextProvider>
  );
};

export default Scenario;
