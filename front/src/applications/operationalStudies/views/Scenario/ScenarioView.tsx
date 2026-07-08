import { usePersistScenarioHeader } from 'applications/operationalStudies/hooks/usePersistScenarioHeader';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import { ScenarioDataContextProvider } from 'applications/operationalStudies/hooks/useScenarioDataContext';
import { RollingStockContextProvider } from 'common/RollingStockContext';
import { SubCategoryContextProvider } from 'common/SubCategoryContext';

import ScenarioContent from './components/ScenarioContent';
import ScenarioHeader from './components/ScenarioHeader';

const Scenario = () => {
  const { scenario, sandboxId } = useScenario();

  const { activeBoards, toggleBoard } = usePersistScenarioHeader(scenario?.id, [
    'trains',
    'std',
    'tables',
    'sdd',
    'map',
  ]);

  if (!scenario || !sandboxId) return null;

  return (
    <div id="scenario">
      <ScenarioContextProvider scenario={scenario} sandboxId={sandboxId}>
        <ScenarioHeader activeBoards={activeBoards} toggleBoard={toggleBoard} />
        <RollingStockContextProvider>
          <SubCategoryContextProvider>
            <ScenarioDataContextProvider>
              <ScenarioContent activeBoards={activeBoards} toggleBoard={toggleBoard} />
            </ScenarioDataContextProvider>
          </SubCategoryContextProvider>
        </RollingStockContextProvider>
      </ScenarioContextProvider>
    </div>
  );
};

export default Scenario;
