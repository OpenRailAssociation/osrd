import { usePersistScenarioHeader } from 'applications/operationalStudies/hooks/usePersistScenarioHeader';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import { ScenarioLiveUpdatesProvider } from 'applications/operationalStudies/hooks/useScenarioLiveUpdates';
import type { Board } from 'applications/operationalStudies/types';
import { RollingStockContextProvider } from 'common/RollingStockContext';
import { SubCategoryContextProvider } from 'common/SubCategoryContext';

import ScenarioContent from './components/ScenarioContent';
import ScenarioHeader from './components/ScenarioHeader';

const DEFAULT_BOARDS: Board[] = ['trains', 'std', 'table', 'sdd', 'map'];

const Scenario = () => {
  const { scenario, sandboxId } = useScenario();

  const { activeBoards, toggleBoard } = usePersistScenarioHeader(scenario?.id, DEFAULT_BOARDS);

  if (!scenario || !sandboxId) return null;

  return (
    <div id="scenario">
      <ScenarioContextProvider scenario={scenario} sandboxId={sandboxId}>
        <ScenarioLiveUpdatesProvider scenarioId={scenario.id}>
          <ScenarioHeader activeBoards={activeBoards} toggleBoard={toggleBoard} />
          <RollingStockContextProvider>
            <SubCategoryContextProvider>
              <ScenarioContent activeBoards={activeBoards} toggleBoard={toggleBoard} />
            </SubCategoryContextProvider>
          </RollingStockContextProvider>
        </ScenarioLiveUpdatesProvider>
      </ScenarioContextProvider>
    </div>
  );
};

export default Scenario;
