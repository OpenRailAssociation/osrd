const trainNameWithNum = (name, actualTrainCount, total) => {
  if (total === 1) {
    return name;
  }
  // Test if numeric & integer in a good way
  if (/^\d+$/.test(name)) {
    return parseInt(name, 10) + (actualTrainCount - 1);
  }
  return `${name} ${actualTrainCount}`;
};

export default trainNameWithNum;
