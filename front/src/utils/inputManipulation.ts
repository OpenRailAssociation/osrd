export const isCursorSurroundedBySpace = (text: string, cursorPosition: number) =>
  text[cursorPosition - 1] === ' ' &&
  (text[cursorPosition] === ' ' || cursorPosition === text.length);

export const findCurrentWord = (text: string, cursorPosition: number) => {
  const trimmedTextStart = text.trimStart();
  let cumulativeLength = 0;
  const words = trimmedTextStart.split(' ');

  return words.find((word: string, index: number) => {
    cumulativeLength += word.length + (index < words.length - 1 ? 1 : 0);
    return cursorPosition <= cumulativeLength;
  });
};

export const calculateAdjustedCursorPositionRem = (
  initialCursorPositionRem: number,
  trigramCount: number,
  monospaceOneCharREMWidth: number
) =>
  initialCursorPositionRem -
  trigramCount * (3 * monospaceOneCharREMWidth + monospaceOneCharREMWidth);
