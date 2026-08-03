import React, { useEffect, useRef, useState } from 'react';

import { ComboBox } from '@osrd-project/ui-core';
import { KebabHorizontal } from '@osrd-project/ui-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';

import { ListElementComponent } from './ComboBoxCustomList/ListElementComponent';

type OpCh = {
  code: string;
  isCandidate?: boolean;
  isBestSuggestion?: boolean;
};

type Suggestion = {
  id: string;
  mainCode: string;
  name: string;
  secondaryCodeList: OpCh[];
};

const ALL_SUGGESTIONS: Suggestion[] = [
  {
    id: '1',
    name: 'Le Havre',
    mainCode: 'LHV',
    secondaryCodeList: [
      { code: 'BV' },
      { code: 'BR' },
      { code: 'BB' },
      { code: 'BK' },
      { code: 'UU' },
      { code: 'TT' },
      { code: 'TR' },
      { code: 'AC' },
    ],
  },
  {
    id: '2',
    name: 'Le Havre Graville',
    mainCode: 'LHG',
    secondaryCodeList: [{ code: 'BV' }, { code: 'BQ' }],
  },
  {
    id: '3',
    name: 'Bordeaux',
    mainCode: 'BDX',
    secondaryCodeList: [{ code: 'BV' }, { code: 'BR' }, { code: 'BB' }],
  },
  {
    id: '4',
    name: 'Bruxelles Midi',
    mainCode: 'BRM',
    secondaryCodeList: [{ code: 'BM' }, { code: 'BR' }],
  },
  {
    id: '5',
    name: 'Auber',
    mainCode: 'AUB',
    secondaryCodeList: [{ code: '00' }, { code: 'BV' }],
  },
  {
    id: '6',
    name: 'Fontenay aux roses',
    mainCode: 'FAR',
    secondaryCodeList: [{ code: '00' }, { code: 'BV' }],
  },
  {
    id: '7',
    name: 'Sceaux',
    mainCode: 'SCX',
    secondaryCodeList: [{ code: '00' }, { code: 'BV' }],
  },
  {
    id: '8',
    name: 'Robinson',
    mainCode: 'ROB',
    secondaryCodeList: [{ code: '00' }, { code: 'BV' }],
  },
  {
    id: '9',
    name: 'Port-Royal',
    mainCode: 'PRY',
    secondaryCodeList: [{ code: '00' }, { code: 'BV' }],
  },
  {
    id: '10',
    name: 'Denfert-Rochereau',
    mainCode: 'DFR',
    secondaryCodeList: [{ code: '00' }, { code: 'BV' }],
  },
  {
    id: '11',
    name: 'Lille Europe',
    mainCode: 'LEW',
    secondaryCodeList: [{ code: '00' }, { code: 'BV' }],
  },
  {
    id: '12',
    name: 'Lille Flandres',
    mainCode: 'LE',
    secondaryCodeList: [{ code: '00' }, { code: 'BV' }],
  },
];
const normalize = (value: string) => value.normalize('NFD').toLowerCase();

const getBaseScore = (suggestion: Suggestion, trigram: string, name: string) => {
  const nameNorm = normalize(suggestion.name);
  const trigramUpper = suggestion.mainCode.toUpperCase();
  if (trigramUpper === trigram) return 0;
  else if (trigramUpper.startsWith(trigram)) return 1;
  else if (trigramUpper.includes(trigram)) return 2;
  else if (nameNorm.startsWith(name)) return 3;
  else if (nameNorm.includes(name)) return 4;
  return 99;
};

function filterAndMarkSuggestions(allSuggestions: Suggestion[], rawQuery: string): Suggestion[] {
  const query = rawQuery.trim();
  const endsWithSpace = /\s$/.test(rawQuery);

  // nothing is typed, all suggestions are candidates
  if (!query) {
    return allSuggestions.map((suggestion) => ({
      ...suggestion,
      chList: suggestion.secondaryCodeList.map((secondaryCode) => ({
        ...secondaryCode,
        isCandidate: true,
        isBestSuggestion: false,
      })),
    }));
  }

  const tokens = query.split(/[\s]+/).filter(String);
  const isSingleToken = tokens.length === 1;

  const lastToken = tokens.length > 1 ? tokens[tokens.length - 1] : '';
  const baseText = tokens.length > 1 ? tokens.slice(0, -1).join(' ') : tokens[0];

  const baseNorm = normalize(baseText);
  const baseUpper = baseText.toUpperCase();
  const lastTokenUpper = lastToken.toUpperCase();

  if (endsWithSpace && isSingleToken) {
    const tokenUpper = tokens[0].toUpperCase();
    const exactTrigramMatches = allSuggestions.filter(
      (s) => s.mainCode.toUpperCase() === tokenUpper
    );

    if (exactTrigramMatches.length > 0) {
      return exactTrigramMatches.map((s) => ({
        ...s,
        secondaryCodeList: s.secondaryCodeList.map((secondaryCode) => ({
          ...secondaryCode,
          isCandidate: true,
          isBestSuggestion: false,
        })),
      }));
    }
  }

  if (!isSingleToken && lastToken) {
    const exactTrigramAndChMatches = allSuggestions
      .filter(
        (s) =>
          s.mainCode.toUpperCase() === baseUpper &&
          s.secondaryCodeList.some(
            (secondaryCode) => secondaryCode.code.toUpperCase() === lastTokenUpper
          )
      )
      .map((s) => ({
        ...s,
        secondaryCodeList: s.secondaryCodeList.map((secondaryCode) => {
          const isExactCh = secondaryCode.code.toUpperCase() === lastTokenUpper;
          return {
            ...secondaryCode,
            isCandidate: isExactCh,
            isBestSuggestion: isExactCh,
          };
        }),
      }));

    if (exactTrigramAndChMatches.length > 0) return exactTrigramAndChMatches;
  }

  const scored = allSuggestions
    .map((suggestion) => {
      const nameNorm = normalize(suggestion.name);
      const trigramUpper = suggestion.mainCode.toUpperCase();

      // secondaryCodePrefixMatch should be false if there is no lastToken
      const secondaryCodePrefixMatch = lastToken
        ? suggestion.secondaryCodeList.some((secondaryCode) =>
            secondaryCode.code.toUpperCase().startsWith(lastTokenUpper)
          )
        : false;

      if (isSingleToken) {
        const token = tokens[0];
        const tokenNorm = normalize(token);
        const tokenUpper = token.toUpperCase();

        const matchesName = nameNorm.includes(tokenNorm);
        const matchesTrigram = trigramUpper.includes(tokenUpper);
        const matchesSecondaryCode = suggestion.secondaryCodeList.some((secondaryCode) =>
          secondaryCode.code.toUpperCase().includes(tokenUpper)
        );

        if (!matchesName && !matchesTrigram && !matchesSecondaryCode) return null;

        const trigramExact = trigramUpper === tokenUpper;
        const trigramPrefix = !trigramExact && trigramUpper.startsWith(tokenUpper);
        const namePrefix = nameNorm.startsWith(tokenNorm);
        const nameContains = matchesName && !namePrefix;
        const chPrefix = suggestion.secondaryCodeList.some((secondaryCode) =>
          secondaryCode.code.toUpperCase().startsWith(tokenUpper)
        );
        const chContains = matchesSecondaryCode && !chPrefix;

        let category = 6;
        if (trigramExact) category = 0;
        else if (trigramPrefix) category = 1;
        else if (namePrefix) category = 2;
        else if (nameContains) category = 3;
        else if (chPrefix) category = 4;
        else if (chContains) category = 5;

        return {
          suggestion: {
            ...suggestion,
            secondaryCodeList: suggestion.secondaryCodeList.map((secondaryCode) => ({
              ...secondaryCode,
              isCandidate: true,
              isBestSuggestion: false,
            })),
          },
          category,
          baseScore: 99,
          secondaryCodeScore: 99,
        };
      }

      // If last token doesn't start like a known secondary code, we keep the full text matching
      if (!secondaryCodePrefixMatch) {
        const fullNorm = normalize(query);
        const fullUpper = query.toUpperCase();

        const matchesFullName = nameNorm.includes(fullNorm);
        const matchesFullTrig = trigramUpper.includes(fullUpper);

        if (!matchesFullName && !matchesFullTrig) return null;

        return {
          suggestion: {
            ...suggestion,
            secondaryCodeList: suggestion.secondaryCodeList.map((secondaryCode) => ({
              ...secondaryCode,
              isCandidate: true,
              isBestSuggestion: false,
            })),
          },
          baseScore: getBaseScore(suggestion, baseUpper, baseNorm),
          secondaryCodeScore: 99,
          category: 0,
        };
      }

      // Query starts as a known secondary code => base must match (name or trigram)
      const baseMatchesName = nameNorm.includes(baseNorm);
      const baseMatchesTrigram = trigramUpper.includes(baseUpper);
      const baseMatches = baseMatchesName || baseMatchesTrigram;
      if (!baseMatches) return null;

      const secondaryCodeList = suggestion.secondaryCodeList.map((secondaryCode) => {
        const codeUpper = secondaryCode.code.toUpperCase();
        return {
          ...secondaryCode,
          isCandidate: codeUpper.startsWith(lastTokenUpper),
          isBestSuggestion: false,
        };
      });
      // we apply scores depending on how suggestion matches base and last token

      const baseScore = getBaseScore(suggestion, baseUpper, baseNorm);
      const secondaryCodeExact = suggestion.secondaryCodeList.some(
        (secondaryCode) => secondaryCode.code.toUpperCase() === lastTokenUpper
      );
      const secondaryCodeScore = secondaryCodeExact ? 0 : 1;

      return {
        suggestion: { ...suggestion, secondaryCodeList: secondaryCodeList },
        baseScore,
        secondaryCodeScore,
        category: 0,
      };
    })
    .filter((x) => x !== null);

  const preliminary = scored
    .sort((a, b) => {
      if (isSingleToken) {
        return a.category - b.category || a.suggestion.name.localeCompare(b.suggestion.name, 'fr');
      }

      return (
        a.baseScore - b.baseScore ||
        a.secondaryCodeScore - b.secondaryCodeScore ||
        a.suggestion.name.localeCompare(b.suggestion.name, 'fr')
      );
    })
    .map((x) => x.suggestion);

  let candidateCount = 0;
  let bestSuggestionIndex = -1;
  let bestChIndex = -1;

  preliminary.forEach((s, sIndex) => {
    s.secondaryCodeList.forEach((secondaryCode, chIndex) => {
      if (secondaryCode.isCandidate) {
        candidateCount += 1;
        if (candidateCount === 1) {
          bestSuggestionIndex = sIndex;
          bestChIndex = chIndex;
        }
      }
    });
  });

  // If there is not exactly one candidate, nothing is highlighted
  if (candidateCount !== 1) {
    return preliminary;
  }

  // If there is exactly one candidate, highlight it
  return preliminary.map((s, sIndex) => ({
    ...s,
    chList: s.secondaryCodeList.map((secondaryCode, chIndex) => ({
      ...secondaryCode,
      isBestSuggestion: sIndex === bestSuggestionIndex && chIndex === bestChIndex,
    })),
  }));
}

const ComboBoxStory = (props: { small?: boolean; disabled?: boolean; readOnly?: boolean }) => {
  const maxVisibleSuggestions = 8;
  const [value, setValue] = useState<Suggestion>();
  const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>(
    filterAndMarkSuggestions(ALL_SUGGESTIONS, '')
  );
  const [pickedCh, setPickedSecondaryCode] = useState<string>();
  const pendingPickedChRef = useRef<string>(undefined);
  const valueRef = useRef(value);

  const getSuggestionLabel = (suggestion: Suggestion) =>
    value?.id === suggestion.id && pickedCh ? `${suggestion.name} ${pickedCh}` : suggestion.name;

  const onSelectSuggestion = (suggestion?: Suggestion) => {
    if (!suggestion) {
      setValue(undefined);
      setPickedSecondaryCode(undefined);
      valueRef.current = undefined;
      return;
    }

    const secondaryCodeFromClick = pendingPickedChRef.current;
    pendingPickedChRef.current = undefined;

    const fallback =
      suggestion.secondaryCodeList.find((secondaryCode) => secondaryCode.isBestSuggestion)?.code ??
      suggestion.secondaryCodeList[0]?.code;

    setValue(suggestion);
    setPickedSecondaryCode(secondaryCodeFromClick ?? fallback);
    valueRef.current = suggestion;
  };

  const onChange = (newValue: string) => {
    setFilteredSuggestions(filterAndMarkSuggestions(ALL_SUGGESTIONS, newValue));
  };

  const resetSuggestions = () => {
    const v = valueRef.current;
    const query = v ? getSuggestionLabel(v) : '';
    setFilteredSuggestions(filterAndMarkSuggestions(ALL_SUGGESTIONS, query));
  };

  const visibleSuggestions = filteredSuggestions.slice(0, maxVisibleSuggestions);
  const hasMore = filteredSuggestions.length > maxVisibleSuggestions;
  const numberOfSuggestionsToShow = hasMore
    ? visibleSuggestions.length + 1
    : visibleSuggestions.length;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  return (
    <div style={{ maxWidth: '20rem' }}>
      <ComboBox
        id="combo-box-custom"
        value={value}
        numberOfSuggestionsToShow={numberOfSuggestionsToShow}
        suggestions={visibleSuggestions}
        getSuggestionLabel={getSuggestionLabel}
        onSelectSuggestion={onSelectSuggestion}
        resetSuggestions={resetSuggestions}
        onChange={onChange}
        small
        renderListElementComponent={({ suggestion, index, isActive, isSelected }) => (
          <ListElementComponent
            suggestion={suggestion}
            index={index}
            isActive={isActive}
            isSelected={isSelected}
            onPickSecondaryCode={(code: string) => {
              pendingPickedChRef.current = code;
            }}
          />
        )}
        renderFooterItem={
          hasMore
            ? () => (
                <li className="suggestion-item suggestion-item--more">
                  <span className="op-suggestion-kebab">
                    <KebabHorizontal size="sm" />
                  </span>
                </li>
              )
            : undefined
        }
        {...props}
      />
    </div>
  );
};

const meta: Meta<typeof ComboBoxStory> = {
  component: ComboBoxStory,
  args: {
    small: false,
    disabled: false,
    readOnly: false,
  },
  render: (props) => <ComboBoxStory {...props} />,
  title: 'core/ComboBox',
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ComboBox>;

export const WithCustomListElement: Story = {
  args: {
    label: 'Operational Point',
    type: 'text',
  },
};
