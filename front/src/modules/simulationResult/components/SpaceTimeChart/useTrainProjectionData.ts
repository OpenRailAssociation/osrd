import useSimulationResults from 'applications/operationalStudies/hooks/useSimulationResults';

const useTrainProjectionData = (infraId: number) => {
  const simulationResults = useSimulationResults(infraId);
  const isValid = simulationResults?.isValid ?? false;

  const invalidOps = useInvalidTrainOps(infraId, simulationResults?.train, isValid);

  const operationalPoints = isValid
    ? simulationResults!.pathProperties.operationalPoints
    : invalidOps;

  return {
    operationalPoints,
    train: simulationResults?.train,
    isValid,
  };
};

export default useTrainProjectionData;
