import { uniqBy } from 'lodash';

import { normalizeName, splitTokens, toUpper } from 'utils/strings';

import type { OperationalPointSuggestion } from '../views/Scenario/components/ManageTrainSchedule/Itinerary/ComboBoxCustomList/ListElementComponent';
import {
  secondaryCodeStarts,
  secondaryCodeIncludes,
  lastTokenMatchesIncludes,
  shouldKeepMainCodeLock,
  tokenMatchesStartNoCh,
  tokenMatchesIncludesNoCh,
  lastTokenMatchesStarts,
} from './suggestionMatchers';

/**
 * ranks and filters suggestions based on a single search token.
 * returns suggestions ordered by match quality: exact name > exact mainCode > starts with > includes > secondary code matches
 */
export const rankSingleTokenSuggestions = (
  suggestions: OperationalPointSuggestion[],
  tokenRaw: string,
  fullRaw: string
): OperationalPointSuggestion[] => {
  const tokenNormalized = normalizeName(tokenRaw);
  const tokenUpper = toUpper(tokenRaw);
  const endWithSpace = /\s+$/.test(fullRaw);

  const exactNames = suggestions.filter((s) => normalizeName(s.name) === tokenNormalized);

  const mainCodeExact = suggestions.filter((s) => toUpper(s.mainCode) === tokenUpper);
  if (mainCodeExact.length && endWithSpace) return uniqBy(mainCodeExact, 'id');

  const mainCodeStarts: OperationalPointSuggestion[] = [];
  const nameStarts: OperationalPointSuggestion[] = [];
  const mainCodeIncludes: OperationalPointSuggestion[] = [];
  const nameIncludes: OperationalPointSuggestion[] = [];

  const secondaryCodePrefixMatches: OperationalPointSuggestion[] = [];
  const secondaryCodeSubstringMatches: OperationalPointSuggestion[] = [];

  for (const s of suggestions) {
    const nameNorm = normalizeName(s.name);
    const mainCodeUpper = toUpper(s.mainCode);
    if (mainCodeUpper.startsWith(tokenUpper)) mainCodeStarts.push(s);
    if (nameNorm.startsWith(tokenNormalized)) nameStarts.push(s);
    if (mainCodeUpper.includes(tokenUpper)) mainCodeIncludes.push(s);
    if (nameNorm.includes(tokenNormalized)) nameIncludes.push(s);
    if (secondaryCodeStarts(s, tokenUpper)) secondaryCodePrefixMatches.push(s);
    if (secondaryCodeIncludes(s, tokenUpper)) secondaryCodeSubstringMatches.push(s);
  }

  return uniqBy(
    [
      ...exactNames,
      ...mainCodeExact,
      ...mainCodeStarts,
      ...nameStarts,
      ...mainCodeIncludes,
      ...nameIncludes,
      ...secondaryCodePrefixMatches,
      ...secondaryCodeSubstringMatches,
    ],
    'id'
  );
};

/**
 * Ranks suggestions when the user input contains multiple tokens.
 * Prioritizes: mainCode lock --> full phrase match --> base phrase + secondary code --> all tokens match.
 */
export const rankMultiTokenSuggestions = (
  suggestions: OperationalPointSuggestion[],
  raw: string
) => {
  const tokens = splitTokens(raw);
  if (tokens.length < 2) return [];

  const lastToken = tokens[tokens.length - 1];
  const baseTokens = tokens.slice(0, -1);

  const fullPhrase = normalizeName(tokens.join(' '));
  const basePhrase = normalizeName(baseTokens.join(' '));
  const lastTokenUpper = toUpper(lastToken);

  const firstTokenUpper = toUpper(tokens[0] ?? '');

  // 0) strict lock
  const strictMatches = suggestions.filter(
    (s) =>
      baseTokens.every((t) => tokenMatchesIncludesNoCh(s, t)) &&
      lastTokenMatchesIncludes(s, lastToken)
  );

  // base for further sorting
  const sortingBase = strictMatches.length ? strictMatches : suggestions;

  // Buckets grouped by match type
  const mainCodePinned: OperationalPointSuggestion[] = [];
  const allTokensStart: OperationalPointSuggestion[] = [];
  const fullPhraseMatches = {
    starts: [] as OperationalPointSuggestion[],
    includes: [] as OperationalPointSuggestion[],
  };
  const basePhraseMatches = {
    startsWithSecondaryCode: [] as OperationalPointSuggestion[],
    starts: [] as OperationalPointSuggestion[],
    includesWithSecondaryCode: [] as OperationalPointSuggestion[],
    includes: [] as OperationalPointSuggestion[],
  };

  for (const s of sortingBase) {
    const nameNorm = normalizeName(s.name);
    const mainCodeUpper = toUpper(s.mainCode);
    const hasSecondaryCodePrefix = secondaryCodeStarts(s, lastTokenUpper);

    // Main code pinned
    if (firstTokenUpper && mainCodeUpper === firstTokenUpper && shouldKeepMainCodeLock(s, tokens)) {
      mainCodePinned.push(s);
    }

    // Full phrase matching
    if (nameNorm.startsWith(fullPhrase)) {
      fullPhraseMatches.starts.push(s);
    } else if (nameNorm.includes(fullPhrase)) {
      fullPhraseMatches.includes.push(s);
    }

    // Base phrase matching
    const startsWithBase = nameNorm.startsWith(basePhrase);
    const includesBase = !startsWithBase && nameNorm.includes(basePhrase);
    if (startsWithBase) {
      if (hasSecondaryCodePrefix) basePhraseMatches.startsWithSecondaryCode.push(s);
      basePhraseMatches.starts.push(s);
    } else if (includesBase) {
      if (hasSecondaryCodePrefix) basePhraseMatches.includesWithSecondaryCode.push(s);
      basePhraseMatches.includes.push(s);
    }

    // All tokens start match
    if (
      baseTokens.every((t) => tokenMatchesStartNoCh(s, t)) &&
      lastTokenMatchesStarts(s, lastToken)
    ) {
      allTokensStart.push(s);
    }
  }

  return uniqBy(
    [
      ...mainCodePinned,
      ...fullPhraseMatches.starts,
      ...fullPhraseMatches.includes,
      ...basePhraseMatches.startsWithSecondaryCode,
      ...basePhraseMatches.starts,
      ...basePhraseMatches.includesWithSecondaryCode,
      ...basePhraseMatches.includes,
      ...allTokensStart,
      ...strictMatches,
    ],
    'id'
  );
};

// sorting helpers //
export const rankSuggestions = (suggestions: OperationalPointSuggestion[], rawInput: string) => {
  const tokens = splitTokens(rawInput);
  if (tokens.length === 0) return [];
  if (tokens.length === 1) return rankSingleTokenSuggestions(suggestions, tokens[0], rawInput);
  return rankMultiTokenSuggestions(suggestions, rawInput);
};

// nothing typed / one word: all candidates, no best suggestion
// if last token doesn't match any secondaryCode prefix in any suggestion => all candidates
// candidates are those whose secondaryCode startsWith(lastToken), others grey; if none => all grey
export const markSuggestions = (suggestions: OperationalPointSuggestion[], rawInput: string) => {
  const tokens = splitTokens(rawInput);
  const markAllAsCandidates = (items: OperationalPointSuggestion[]) =>
    items.map((s) => ({
      ...s,
      secondaryCodeList: s.secondaryCodeList.map((secondaryCode) => ({
        ...secondaryCode,
        isCandidate: true,
        isBestSuggestion: false,
      })),
    }));

  // 0 ou 1 token => tout est candidat, pas de best
  if (tokens.length <= 1) {
    return markAllAsCandidates(suggestions);
  }

  const lastTokenUpper = toUpper(tokens[tokens.length - 1]);

  let hasAnyCandidate = false;

  const marked = suggestions.map((s) => ({
    ...s,
    secondaryCodeList: s.secondaryCodeList.map((secondaryCode) => {
      const isCandidate = toUpper(secondaryCode.code).startsWith(lastTokenUpper);
      if (isCandidate) hasAnyCandidate = true;
      return { ...secondaryCode, isCandidate, isBestSuggestion: false };
    }),
  }));

  if (!hasAnyCandidate) {
    return markAllAsCandidates(suggestions);
  }

  let first: { sIndex: number; chIndex: number } | null = null;
  let count = 0;

  marked.forEach((s, sIndex) => {
    s.secondaryCodeList.forEach((secondaryCode, chIndex) => {
      if (secondaryCode.isCandidate) {
        count += 1;
        if (count === 1) first = { sIndex, chIndex };
      }
    });
  });

  if (count !== 1 || !first) return marked;

  return marked.map((s, sIndex) => ({
    ...s,
    secondaryCodeList: s.secondaryCodeList.map((secondaryCode, chIndex) => ({
      ...secondaryCode,
      isBestSuggestion: sIndex === first!.sIndex && chIndex === first!.chIndex,
    })),
  }));
};
