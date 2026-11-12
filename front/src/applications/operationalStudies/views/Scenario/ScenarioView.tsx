import { usePersistScenarioHeader } from 'applications/operationalStudies/hooks/usePersistScenarioHeader';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { Board } from 'applications/operationalStudies/types';
import { RollingStockContextProvider } from 'common/RollingStockContext';
import { SubCategoryContextProvider } from 'common/SubCategoryContext';
import ScenarioNoTimetable from 'modules/scenario/components/ScenarioNoTimetable';

import ScenarioContent from './components/ScenarioContent';
import ScenarioHeader from './components/ScenarioHeader';

const DEFAULT_BOARDS: Board[] = ['trains', 'std', 'table', 'sdd', 'map'];

const Scenario = () => {
  const { scenario, timetable, sandboxId } = useScenario();

  const { activeBoards, toggleBoard } = usePersistScenarioHeader(scenario?.id, DEFAULT_BOARDS);

  if (!scenario) return null;

  const hasNoTimetable = scenario.timetable_summaries.length === 0;

  return (
    <div id="scenario">
      <ScenarioContextProvider scenario={scenario} timetable={timetable} sandboxId={sandboxId}>
        <ScenarioHeader activeBoards={activeBoards} toggleBoard={toggleBoard} />
        {hasNoTimetable && <ScenarioNoTimetable />}
        {/* The sandbox is linked to the timetable: wait for it without hiding the header */}
        {!hasNoTimetable && sandboxId !== undefined && (
          <RollingStockContextProvider>
            <SubCategoryContextProvider>
              <ScenarioContent
                key={timetable?.id}
                activeBoards={activeBoards}
                toggleBoard={toggleBoard}
              />
            </SubCategoryContextProvider>
          </RollingStockContextProvider>
        )}
      </ScenarioContextProvider>
    </div>
  );
};

export default Scenario;
