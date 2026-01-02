import { useMemo, useState } from 'react';

const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const defaultFilterSuggestions = <T>(
  getSuggestionLabel: (suggestion: T) => string,
  suggestions: T[],
  query: string
) => {
  const input = normalizeString(query).trim().toLowerCase();
  if (!input) {
    return suggestions;
  }

  const getSuggestionScore = (suggestion: T) => {
    const suggestionLabel = normalizeString(getSuggestionLabel(suggestion).toLowerCase());
    if (suggestionLabel.startsWith(input)) {
      return 2;
    }
    if (suggestionLabel.includes(input)) {
      return 1;
    }
    return 0;
  };

  return suggestions
    .map((suggestion) => ({
      suggestion,
      score: getSuggestionScore(suggestion),
    }))
    .filter(({ score }) => score > 0)
    .sort(({ score: scoreA }, { score: scoreB }) => scoreB - scoreA)
    .map(({ suggestion }) => suggestion);
};

const useDefaultComboBox = <T>(suggestions: T[], getSuggestionLabel: (suggestion: T) => string) => {
  const [query, setQuery] = useState('');

  const filteredSuggestions = useMemo(
    () => defaultFilterSuggestions(getSuggestionLabel, suggestions, query),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, query]
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
