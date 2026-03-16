import { usePersistScenarioHeader } from 'applications/operationalStudies/hooks/usePersistScenarioHeader';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import { RollingStockContextProvider } from 'common/RollingStockContext';
import { SubCategoryContextProvider } from 'common/SubCategoryContext';

import ScenarioContent from './components/ScenarioContent';
import ScenarioHeader from './components/ScenarioHeader';

const Scenario = () => {
  const { scenario, sandboxId } = useScenario();

  const { activeBoards, toggleBoard } = usePersistScenarioHeader(scenario?.id, [
    'trains',
    'map',
    'std',
    'sdd',
    'tables',
    'chronogram',
  ]);

  if (!scenario || !sandboxId) return null;

  return (
    <ScenarioContextProvider scenario={scenario} sandboxId={sandboxId}>
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
