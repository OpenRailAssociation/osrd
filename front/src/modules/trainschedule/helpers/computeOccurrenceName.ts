const computeOccurrenceName = (pacedTrainName: string, index: number): string => {
  const endByNumber = /\b\w+\s\d+$/;

  if (endByNumber.test(pacedTrainName)) {
    const endOfPacedTrainName = Number(pacedTrainName.split(' ').pop());
    return `${pacedTrainName.replace(/\s\d+$/, '')} ${endOfPacedTrainName + 2 * index}`;
  }
  if (!Number.isNaN(+pacedTrainName)) {
    return `${+pacedTrainName + 2 * index}`;
  }
  return `${pacedTrainName} ${2 * index + 1}`;
};

export default computeOccurrenceName;
