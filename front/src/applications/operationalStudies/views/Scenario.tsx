import { useState } from 'react';

import { useSelector } from 'react-redux';

import ScenarioContent from 'applications/operationalStudies/components/Scenario/ScenarioContent';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioQueryParams from 'applications/operationalStudies/hooks/useScenarioQueryParams';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';
import { getOperationalStudiesInfraID } from 'reducers/osrdconf/operationalStudiesConf/selectors';

import ScenarioHeader from '../v2/components/ScenarioHeader';

const Scenario = () => {
  const { scenario } = useScenario();

  const infraId = useSelector(getOperationalStudiesInfraID);

  // Initialize and sync the URL and local storage with Redux
  useScenarioQueryParams();

  const infraData = useInfraStatus({ infraId });
  const { infra } = infraData;

  const [isTimetableDisplay, setIsTimeTableDisplay] = useState(true);
  const [isConflictsListDisplay, setIsConflictsListDisplay] = useState(true);
  const [isMacroEditorDisplay, setIsMacroEditorDisplay] = useState(true);

  if (!scenario || !infra) return null;

  const toggleTimetable = () => {
    setIsTimeTableDisplay((prev) => !prev);
  };
  const toggleConflictsList = () => {
    setIsConflictsListDisplay((prev) => !prev);
  };
  const toggleMacroEditor = () => {
    setIsMacroEditorDisplay((prev) => !prev);
  };

  return (
    <ScenarioContextProvider infraId={infra.id}>
      <ScenarioHeader
        scenario={scenario}
        infra={infra}
        toggleTimeTable={toggleTimetable}
        toggleConflictsList={toggleConflictsList}
        toggleMacroEditor={toggleMacroEditor}
      />

      <ScenarioContent
        scenario={scenario}
        infra={infra}
        infraMetadata={infraData}
        isTimetableDisplay={isTimetableDisplay}
        isConflictsListDisplay={isConflictsListDisplay}
        isMacroEditorDisplay={isMacroEditorDisplay}
      />
    </ScenarioContextProvider>
  );
};

export default Scenario;
