type ScenarioContentV2Props = {
  displayTimetable: boolean;
  displayConflictsList: boolean;
  displaySpeedSpaceChart: boolean;
  displayManchetteWithSpaceTimeChart: boolean;
  displaySimulationResultMap: boolean;
  displayTimeStopTable: boolean;
};

const ScenarioContentV2 = ({
  displayTimetable,
  displayConflictsList,
  displayManchetteWithSpaceTimeChart,
  displaySimulationResultMap,
  displaySpeedSpaceChart,
  displayTimeStopTable,
}: ScenarioContentV2Props) => {
  const displayCenterColumn =
    displaySpeedSpaceChart ||
    displayManchetteWithSpaceTimeChart ||
    displaySimulationResultMap ||
    displayTimeStopTable;

  return (
    <div className="scenario-content-v2">
      <div style={{ display: displayTimetable ? 'block' : 'none' }} className="left-column" />
      <div className="center-column" />
      <div style={{ display: displayConflictsList ? 'block' : 'none' }} className="right-column" />
    </div>
  );
};

export default ScenarioContentV2;
