import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import ScenarioContent from 'applications/operationalStudies/components/Scenario/ScenarioContent';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import useScenarioQueryParams from 'applications/operationalStudies/hooks/useScenarioQueryParams';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';

const Scenario = () => {
  const { scenario, timetable } = useScenario();

  // Initialize and sync the URL and local storage with Redux
  useScenarioQueryParams();

  const infraData = useInfraStatus();
  const { infra } = infraData;

  if (!scenario || !timetable || !infra) return null;

  return (
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs project={scenario.project} study={scenario.study} scenario={scenario} />
        }
      />
      <ScenarioContent
        scenario={scenario}
        timetable={timetable}
        infra={infra}
        infraMetadata={infraData}
      />
    </>
  );
};

export default Scenario;
