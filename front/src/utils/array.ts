// eslint-disable-next-line import/prefer-default-export
export const isFirstOrLastElement = <T>(array: T[], element: T) =>
  array[0] === element || array[array.length - 1] === element;
