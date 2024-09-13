import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import ScenarioContent from 'applications/operationalStudies/components/Scenario/ScenarioContent';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';

const Scenario = () => {
  const { scenario, timetable } = useScenario();

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
