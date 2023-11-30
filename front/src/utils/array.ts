export const isFirstOrLastElement = <T>(array: T[], element: T) =>
  array[0] === element || array[array.length - 1] === element;

/**
 * Take an array of strings, sort it and split it in two : one array of letter starting strings and one with digit or special characters starting strings.
 */
export const splitArrayByFirstLetter = (array: string[]): [string[], string[]] => {
  if (array.length === 0) return [[], []];
  const sortedArray = [...array].sort();
  const splittingIndex = sortedArray.findIndex((item) => /^[A-Za-z]/.test(item));

  let digitalArray: string[] = [];
  let letterArray: string[] = [];

  if (splittingIndex === -1) {
    // There is no letter starting string in the array
    digitalArray = sortedArray;
  } else {
    digitalArray = sortedArray.slice(0, splittingIndex);
    letterArray = sortedArray.slice(splittingIndex);
  }
  return [digitalArray, letterArray];
};

export const removeElementAtIndex = <T>(array: T[], indexToRemove: number) => {
  const result = [...array];
  result.splice(indexToRemove, 1);
  return result;
};

export const replaceElementAtIndex = <T>(array: T[], indexToRemove: number, newElement: T) => {
  const result = [...array];
  result.splice(indexToRemove, 1, newElement);
  return result;
};

export const removeDuplicates = <T>(array: T[]) => [...new Set(array)];
