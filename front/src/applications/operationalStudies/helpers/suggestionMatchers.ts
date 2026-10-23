import { normalizeName, splitTokens, toUpper } from 'utils/strings';

import type { OperationalPointSuggestion } from '../views/Scenario/components/ManageTrainSchedule/Itinerary/ComboBoxCustomList/ListElementComponent';

export const secondaryCodeStarts = (s: OperationalPointSuggestion, tokenUpper: string) =>
  s.secondaryCodeList.some(
    (secondaryCode) =>
      secondaryCode.code !== null && toUpper(secondaryCode.code).startsWith(tokenUpper)
  );
export const secondaryCodeIncludes = (s: OperationalPointSuggestion, tokenUpper: string) =>
  s.secondaryCodeList.some(
    (secondaryCode) =>
      secondaryCode.code !== null && toUpper(secondaryCode.code).includes(tokenUpper)
  );

export const inferUniqueSecondaryCodeFromInput = (
  suggestion: OperationalPointSuggestion,
  rawInput: string
) => {
  const tokens = splitTokens(rawInput);
  if (tokens.length < 2) return undefined;

  const last = toUpper(tokens[tokens.length - 1]);
  const allCodes = Array.from(
    new Set(
      suggestion.secondaryCodeList
        .map((c) => c.code)
        .filter((code) => code !== null)
        .map(toUpper)
    )
  );

  if (!last) return undefined;

  const exact = allCodes.filter((code) => code === last);
  if (exact.length === 1) return exact[0];

  const pref = allCodes.filter((code) => code.startsWith(last));
  if (pref.length === 1) return pref[0];

  return undefined;
};

export const hasSecondaryCodePrefix = (
  s: OperationalPointSuggestion,
  secondaryCodeTokenUpper: string
) => secondaryCodeStarts(s, secondaryCodeTokenUpper);

export const tokenMatchesIncludesNoCh = (s: OperationalPointSuggestion, token: string) => {
  const tokenNormalized = normalizeName(token);
  const tokenUpper = toUpper(token);
  return (
    normalizeName(s.name).includes(tokenNormalized) || toUpper(s.mainCode).includes(tokenUpper)
  );
};

export const tokenMatchesStartNoCh = (s: OperationalPointSuggestion, token: string) => {
  const tokenNormalized = normalizeName(token);
  const tokenUpper = toUpper(token);
  return (
    normalizeName(s.name).startsWith(tokenNormalized) || toUpper(s.mainCode).startsWith(tokenUpper)
  );
};

// Secondary code only for last token
export const lastTokenMatchesIncludes = (s: OperationalPointSuggestion, lastToken: string) =>
  tokenMatchesIncludesNoCh(s, lastToken) || secondaryCodeIncludes(s, toUpper(lastToken));

export const lastTokenMatchesStarts = (s: OperationalPointSuggestion, lastToken: string) =>
  tokenMatchesStartNoCh(s, lastToken) || secondaryCodeStarts(s, toUpper(lastToken));

// Main code helpers //
export const shouldKeepMainCodeLock = (s: OperationalPointSuggestion, tokens: string[]) => {
  if (tokens.length <= 1) return true;

  const nameNorm = normalizeName(s.name);

  const lastToken = tokens[tokens.length - 1] ?? '';
  const lastTokenUpper = toUpper(lastToken);

  const restText = tokens.slice(1).join(' ').trim();

  const beforeLastText = tokens.slice(1, -1).join(' ').trim();

  const lastIsChForThisSuggestion =
    lastTokenUpper.length >= 2 &&
    lastTokenUpper.length <= 3 &&
    hasSecondaryCodePrefix(s, lastTokenUpper);

  if (lastIsChForThisSuggestion) {
    if (!beforeLastText) return true;
    const beforeNorm = normalizeName(beforeLastText);
    return nameNorm === beforeNorm || nameNorm.startsWith(beforeNorm);
  }

  const restNorm = normalizeName(restText);
  return nameNorm === restNorm || nameNorm.startsWith(restNorm);
};

export const selectSecondaryCode = (
  suggestion: OperationalPointSuggestion,
  rawInput: string,
  forcedSecondaryCode?: string | null
) => {
  if (forcedSecondaryCode !== undefined) return forcedSecondaryCode;
  const unique = inferUniqueSecondaryCodeFromInput(suggestion, rawInput);
  return unique ?? suggestion.secondaryCodeList[0]?.code ?? null;
};
