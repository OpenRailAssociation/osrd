import { norm, splitTokens, toUpper } from 'utils/strings';

import {
  chStarts,
  chIncludes,
  lastTokenMatchesIncludes,
  shouldKeepTrigramLock,
  tokenMatchesStartNoCh,
  tokenMatchesIncludesNoCh,
  lastTokenMatchesStarts,
} from './suggestionMatchers';
import type { OperationalPointSuggestion } from '../views/Scenario/components/ManageTimetableItem/Itinerary/ComboBoxCustomList/ListElementComponent';

export const uniqById = (items: OperationalPointSuggestion[]) => {
  const seen = new Set<string>();
  const uniqueSuggestions: OperationalPointSuggestion[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    uniqueSuggestions.push(it);
  }
  return uniqueSuggestions;
};

export const sortOneWord = (
  suggestions: OperationalPointSuggestion[],
  tokenRaw: string,
  fullRaw: string
): OperationalPointSuggestion[] => {
  const tokenNormalized = norm(tokenRaw);
  const tokenUpper = toUpper(tokenRaw);
  const endWithSpace = /\s+$/.test(fullRaw);

  const nameExact = suggestions.filter((s) => norm(s.name) === tokenNormalized);
  if (nameExact.length) return nameExact; // exact name matches first and is unique suggestion

  const trigramExact = suggestions.filter((s) => toUpper(s.trigram) === tokenUpper);
  if (trigramExact.length && endWithSpace) {
    return uniqById(trigramExact);
  }

  const trigramStarts = suggestions.filter((s) => toUpper(s.trigram).startsWith(tokenUpper));
  const nameStarts = suggestions.filter((s) => norm(s.name).startsWith(tokenNormalized));
  const trigramIncludes = suggestions.filter((s) => toUpper(s.trigram).includes(tokenUpper));
  const nameIncludes = suggestions.filter((s) => norm(s.name).includes(tokenNormalized));
  const chPrefixMatches = suggestions.filter((s) => chStarts(s, tokenUpper));
  const chSubstringMatches = suggestions.filter((s) => chIncludes(s, tokenUpper));

  return uniqById([
    ...trigramExact,
    ...trigramStarts,
    ...nameStarts,
    ...trigramIncludes,
    ...nameIncludes,
    ...chPrefixMatches,
    ...chSubstringMatches,
  ]);
};

export const sortMultiTokens = (suggestions: OperationalPointSuggestion[], raw: string) => {
  const tokens = splitTokens(raw);
  if (tokens.length < 2) return [];

  const lastToken = tokens[tokens.length - 1];
  const baseTokens = tokens.slice(0, -1);

  const fullPhrase = norm(tokens.join(' '));
  const basePhrase = norm(baseTokens.join(' '));
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

  const rankedSuggestions: OperationalPointSuggestion[] = [];
  const appendSuggestions = (items: OperationalPointSuggestion[]) => {
    rankedSuggestions.push(...items);
  };

  if (firstTokenUpper) {
    const trigramExactPinned = suggestions
      .filter((s) => toUpper(s.trigram) === firstTokenUpper)
      .filter((s) => shouldKeepTrigramLock(s, tokens));
    appendSuggestions(trigramExactPinned);
  }

  // 1) full query
  appendSuggestions(sortingBase.filter((s) => norm(s.name).startsWith(fullPhrase)));
  appendSuggestions(sortingBase.filter((s) => norm(s.name).includes(fullPhrase)));

  // 2) baseStarts + secondaryCode prefix on last token
  const nameStartsWithBasePhrase = sortingBase.filter((s) => norm(s.name).startsWith(basePhrase));
  if (nameStartsWithBasePhrase.length) {
    const chPrefixMatchesOnLastToken = nameStartsWithBasePhrase.filter((s) =>
      chStarts(s, lastTokenUpper)
    );
    appendSuggestions(chPrefixMatchesOnLastToken);
    appendSuggestions(nameStartsWithBasePhrase);
  }

  const nameIncludesBasePhrase = sortingBase.filter((s) => norm(s.name).includes(basePhrase));
  if (nameIncludesBasePhrase.length) {
    const chPrefixMatchesOnLastToken = nameIncludesBasePhrase.filter((s) =>
      chStarts(s, lastTokenUpper)
    );
    appendSuggestions(chPrefixMatchesOnLastToken);
    appendSuggestions(nameIncludesBasePhrase);
  }

  // 3) allStarts
  const allTokensStartMatch = sortingBase.filter(
    (s) =>
      baseTokens.every((t) => tokenMatchesStartNoCh(s, t)) && lastTokenMatchesStarts(s, lastToken)
  );
  appendSuggestions(allTokensStartMatch);

  // 4) fallback locked
  appendSuggestions(strictMatches);

  return uniqById(rankedSuggestions);
};

// sorting helpers //
export const sortSuggestions = (suggestions: OperationalPointSuggestion[], rawInput: string) => {
  const tokens = splitTokens(rawInput);
  if (tokens.length === 0) return [];
  if (tokens.length === 1) return sortOneWord(suggestions, tokens[0], rawInput);
  return sortMultiTokens(suggestions, rawInput);
};

// nothing typed / one word: all candidates, no best suggestion
// if last token doesn't match any secondaryCode prefix in any suggestion => all candidates
// candidates are those whose secondaryCode startsWith(lastToken), others grey; if none => all grey
export const markSuggestions = (suggestions: OperationalPointSuggestion[], rawInput: string) => {
  const tokens = splitTokens(rawInput);
  if (tokens.length <= 1) {
    return suggestions.map((s) => ({
      ...s,
      chList: s.chList.map((secondaryCode) => ({
        ...secondaryCode,
        isCandidate: true,
        isBestSuggestion: false,
      })),
    }));
  }

  const lastTokenUpper = toUpper(tokens[tokens.length - 1]);

  const isKnownCh = suggestions.some((s) =>
    s.chList.some((secondaryCode) => toUpper(secondaryCode.code).startsWith(lastTokenUpper))
  );

  if (!isKnownCh) {
    return suggestions.map((s) => ({
      ...s,
      chList: s.chList.map((secondaryCode) => ({
        ...secondaryCode,
        isCandidate: true,
        isBestSuggestion: false,
      })),
    }));
  }

  const marked = suggestions.map((s) => ({
    ...s,
    chList: s.chList.map((secondaryCode) => {
      const isCandidate = toUpper(secondaryCode.code).startsWith(lastTokenUpper);
      return { ...secondaryCode, isCandidate, isBestSuggestion: false };
    }),
  }));

  // bestSuggestion only if there is exactly 1 candidate overall
  let first: { sIndex: number; chIndex: number } | null = null;
  let count = 0;

  marked.forEach((s, sIndex) => {
    s.chList.forEach((secondaryCode, chIndex) => {
      if (secondaryCode.isCandidate) {
        count += 1;
        if (count === 1) first = { sIndex, chIndex };
      }
    });
  });

  if (count !== 1 || !first) return marked;

  return marked.map((s, sIndex) => ({
    ...s,
    chList: s.chList.map((secondaryCode, chIndex) => ({
      ...secondaryCode,
      isBestSuggestion: sIndex === first!.sIndex && chIndex === first!.chIndex,
    })),
  }));
};
