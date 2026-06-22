import { useMemo, useState } from 'react';

/**
 * Removes the accents and lowercases the input.
 */
export const normalizeString = (str: string) =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Filter the options, keeping only the one that have a suggestion label that contain
 * the query, and sorting them so the one that starts with the query come first.
 */
export const defaultFilterSuggestions = <T>(
  labels: { label: string; suggestion: T }[],
  query: string
) => {
  const input = normalizeString(query).trim();
  if (!input) {
    return labels.map(({ suggestion }) => suggestion);
  }

  const getSuggestionScore = (label: string) => {
    if (label.startsWith(input)) {
      return 2;
    }
    if (label.includes(input)) {
      return 1;
    }
    return 0;
  };

  return labels
    .map(({ label, suggestion }) => ({
      suggestion,
      score: getSuggestionScore(label),
    }))
    .filter(({ score }) => score > 0)
    .sort(({ score: scoreA }, { score: scoreB }) => scoreB - scoreA)
    .map(({ suggestion }) => suggestion);
};

const useDefaultComboBox = <T>(suggestions: T[], getSuggestionLabel: (suggestion: T) => string) => {
  const [query, setQuery] = useState('');

  const labels = useMemo(
    () =>
      suggestions.map((suggestion: T) => ({
        label: normalizeString(getSuggestionLabel(suggestion)),
        suggestion,
      })),
    [suggestions, getSuggestionLabel]
  );

  const filteredSuggestions = useMemo(
    () => defaultFilterSuggestions(labels, query),
    [labels, query]
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const resetSuggestions = () => {
    setQuery('');
  };

  return { suggestions: filteredSuggestions, onChange, resetSuggestions };
};

export default useDefaultComboBox;
