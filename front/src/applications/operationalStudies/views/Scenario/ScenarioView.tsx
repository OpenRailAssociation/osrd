import { usePersistScenarioHeader } from 'applications/operationalStudies/hooks/usePersistScenarioHeader';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import { RollingStockContextProvider } from 'common/RollingStockContext';
import { SubCategoryContextProvider } from 'common/SubCategoryContext';

import ScenarioContent from './components/ScenarioContent';
import ScenarioHeader from './components/ScenarioHeader';

const Scenario = () => {
  const { scenario } = useScenario();

  const { activeBoards, toggleBoard } = usePersistScenarioHeader(scenario?.id, [
    'trains',
    'map',
    'std',
    'sdd',
    'tables',
  ]);

  if (!scenario) return null;

  return (
    <ScenarioContextProvider scenario={scenario}>
      <ScenarioHeader activeBoards={activeBoards} toggleBoard={toggleBoard} />
      <RollingStockContextProvider>
        <SubCategoryContextProvider>
          <ScenarioContent activeBoards={activeBoards} />
        </SubCategoryContextProvider>
      </RollingStockContextProvider>
    </ScenarioContextProvider>
  );
};

export default Scenario;
