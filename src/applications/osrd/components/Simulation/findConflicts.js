import drawPoints from 'applications/osrd/components/Simulation/drawPoints';

const findConflicts = (chart, dataSimulation, rotate) => {
  const groupID = `spaceTime-${dataSimulation.name}`;
  // Looking for common zone of potentials conflicts
  const conflicts = dataSimulation[0].currentBlocksection.filter(
    (step) => step.time >= dataSimulation[1].brakingDistance[0].time,
  );
  const conflicts2 = conflicts.filter(
    (stepA) => dataSimulation[1].brakingDistance.filter(
      (stepB) => stepA.time >= stepB.time && stepA.value <= stepB.value,
    ).length > 0,
  );
  drawPoints(chart, '#f00', conflicts2, groupID, ['time', 'value'], rotate);
};

export default findConflicts;
