import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';

export const isCursorSurroundedBySpace = (text: string, cursorPosition: number) =>
  (text[cursorPosition - 1] === ' ' &&
    (text[cursorPosition] === ' ' || cursorPosition === text.length)) ||
  (text[cursorPosition - 1] === ' ' && text[cursorPosition].match(/\S/));

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

export const replaceCurrentWord = (
  inputText: string,
  cursorPosition: number,
  result: SearchResultItemOperationalPoint
) => {
  const currentWord = findCurrentWord(inputText, cursorPosition) || '';
  let newText;

  if (currentWord.length > 0) {
    newText = `${inputText.substring(0, cursorPosition - currentWord.length)}${result.trigram}${inputText.substring(cursorPosition)}`;
  } else {
    newText = inputText;
  }

  return newText;
};
