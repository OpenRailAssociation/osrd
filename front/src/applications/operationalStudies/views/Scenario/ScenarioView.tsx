import { useSelector } from 'react-redux';

import { usePersistScenarioHeader } from 'applications/operationalStudies/hooks/usePersistScenarioHeader';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import { RollingStockContextProvider } from 'common/RollingStockContext';
import { SubCategoryContextProvider } from 'common/SubCategoryContext';
import ScenarioNoTimetable from 'modules/scenario/components/ScenarioNoTimetable';
import { getFeatureFlag } from 'reducers/user/userSelectors';

import ScenarioContent from './components/ScenarioContent';
import ScenarioHeader from './components/ScenarioHeader';

const Scenario = () => {
  const { scenario, sandboxId } = useScenario();
  const multipleTimetablesEnabled = useSelector(getFeatureFlag('multipleTimetables'));

  const { activeBoards, toggleBoard } = usePersistScenarioHeader(scenario?.id, [
    'trains',
    'std',
    'table',
    'sdd',
    'map',
  ]);

  if (!scenario || !sandboxId) return null;

  // TODO(#18904): a scenario cannot actually be created without a timetable yet
  // (`timetable_id` is still required in a scenario until #18857/#18863),
  // remove ` && !scenario.timetable_id` for test purposes.
  const hasNoTimetable = multipleTimetablesEnabled && !scenario.timetable_id;

  return (
    <div id="scenario">
      <ScenarioContextProvider scenario={scenario} sandboxId={sandboxId}>
        <ScenarioHeader activeBoards={activeBoards} toggleBoard={toggleBoard} />
        {hasNoTimetable ? (
          <ScenarioNoTimetable />
        ) : (
          <RollingStockContextProvider>
            <SubCategoryContextProvider>
              <ScenarioContent activeBoards={activeBoards} toggleBoard={toggleBoard} />
            </SubCategoryContextProvider>
          </RollingStockContextProvider>
        )}
      </ScenarioContextProvider>
    </div>
  );
};

export default Scenario;
