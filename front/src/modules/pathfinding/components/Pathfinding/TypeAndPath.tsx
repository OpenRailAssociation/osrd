/* eslint-disable jsx-a11y/no-autofocus */
import { useEffect, useMemo, useRef, useState } from 'react';

import { Rocket } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { v4 as uuidV4 } from 'uuid';

import type {
  PostSearchApiArg,
  SearchPayload,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import type { PathStepV2 } from 'reducers/osrdconf/types';
import { useDebounce } from 'utils/hooks/useDebounce';
import {
  isCursorSurroundedBySpace,
  findCurrentWord,
  calculateAdjustedCursorPositionRem,
  replaceCurrentWord,
} from 'utils/inputManipulation';

type SearchConstraintType = (string | number | string[])[];

const monospaceOneCharREMWidth = 0.6225;

type TypeAndPathProps = {
  onSubmit: (pathSteps: PathStepV2[]) => void;
};

const TypeAndPath = ({ onSubmit }: TypeAndPathProps) => {
  const [inputText, setInputText] = useState('');
  const [opList, setOpList] = useState<SearchResultItemOperationalPoint[]>([]);
  const infraId = useInfraID();
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useLazyQuery();

  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });

  const [searchResults, setSearchResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [searchState, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearchTerm = useDebounce(searchState, 300);
  const debouncedInputText = useDebounce(inputText.trimEnd(), 500);

  const activeElement = document.activeElement as HTMLInputElement;
  const cursorIndex = activeElement.selectionStart || 0;
  const sortedSearchResults = [...searchResults].sort((a, b) => a.name.localeCompare(b.name));
  const [initialCursorPositionRem, setInitialCursorPositionRem] = useState(0);
  const [mainCodeCount, setMainCodeCount] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleInput = (text: string, newCursorPosition: number) => {
    const trimmedTextStart = text.trimStart();
    setInputText(trimmedTextStart);
    if (isCursorSurroundedBySpace(text, newCursorPosition)) {
      setSearchResults([]);
      setSearch('');
    } else {
      const currentWord = findCurrentWord(trimmedTextStart, newCursorPosition);
      setSearch(currentWord || '');
      setCursorPosition(newCursorPosition);
    }
  };

  const searchOperationalPoints = async () => {
    const searchQuery = ['or', ['search', ['name'], debouncedSearchTerm]];

    const payload: SearchPayload = {
      object: 'operationalpoint',
      query: ['and', searchQuery, infraId !== undefined ? ['=', ['infra_id'], infraId] : true],
    };

    await postSearch({
      searchPayload: payload,
      pageSize: 101,
    })
      .unwrap()
      .then((results) => {
        const filteredResults = results.filter((result) => {
          const searchResult = result as SearchResultItemOperationalPoint;
          // We need to ensure the name is not null since we sort the results depending on it.
          return searchResult.name && searchResult.is_passenger_station;
        });
        setSearchResults(filteredResults as SearchResultItemOperationalPoint[]);
      })
      .catch(() => {
        setSearchResults([]);
      });
  };

  function getOpNames() {
    if (infraId !== undefined) {
      const opMainCodes = inputText.toUpperCase().trimEnd().split(' ');
      const constraint = opMainCodes.reduce(
        (res, mainCode) => [...res, ['=', ['main_code'], mainCode]],
        ['or'] as (string | SearchConstraintType)[]
      );
      const payload: PostSearchApiArg = {
        searchPayload: {
          object: 'operationalpoint',
          query: [
            'and',
            constraint,
            ['=', ['infra_id'], infraId],
            ['=', ['is_passenger_station'], true],
          ],
        },
        pageSize: 100,
      };
      postSearch(payload)
        .unwrap()
        .then((results) => {
          const operationalPoints = [...results] as SearchResultItemOperationalPoint[];
          setOpList(
            opMainCodes.map(
              (mainCode) =>
                operationalPoints.find((op) => op.main_code === mainCode) || {
                  main_code: mainCode,
                }
            ) as SearchResultItemOperationalPoint[]
          );
        });
    }
  }

  const isInvalid = useMemo(() => opList.some((op) => !op.name && op.main_code !== ''), [opList]);

  const handleSubmit = async () => {
    if (infraId && opList.length > 0) {
      const pathSteps: PathStepV2[] = opList
        .filter((op) => op.main_code !== '')
        .map(({ main_code, secondary_code, country_code }) => ({
          id: uuidV4(),
          location: {
            type: 'operational_point_part_reference',
            operational_point: {
              main_code,
              secondary_code,
              country_code,
              type: 'domestic',
            },
          },
          arrival: null,
          stopFor: null,
          theoreticalMargin: null,
          receptionSignal: null,
        }));

      onSubmit(pathSteps);
      setInputText('');
      setSearch('');
    }
  };

  const onResultClick = (result: SearchResultItemOperationalPoint) => {
    const newText = replaceCurrentWord(inputText, cursorPosition, result);

    setInputText(newText);
    setSearch('');
    setMainCodeCount((prev) => prev + 1);

    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPosition = newText.length;
        inputRef.current.focus();
        inputRef.current.selectionStart = newCursorPosition;
        inputRef.current.selectionEnd = newCursorPosition;
        const adjustedCursorPositionRem = calculateAdjustedCursorPositionRem(
          initialCursorPositionRem,
          mainCodeCount,
          monospaceOneCharREMWidth
        );
        document.documentElement.style.setProperty(
          '--cursor-position',
          `${adjustedCursorPositionRem}rem`
        );
      }
    }, 0);
  };

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchOperationalPoints();
    } else if (searchResults.length) {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, inputText]);

  useEffect(() => {
    if (debouncedInputText !== '') {
      getOpNames();
    } else {
      setOpList([]);
    }
  }, [debouncedInputText]);

  useEffect(() => {
    const cursorPositionRem = (cursorIndex - searchState.length / 2) * 0.55;

    document.documentElement.style.setProperty('--cursor-position', `${cursorPositionRem}rem`);
  }, [cursorIndex, searchState]);

  useEffect(() => {
    setInitialCursorPositionRem(0);
  }, []);

  const isSortedSearchResultsDisplayed = useMemo(() => {
    const mainCodes = debouncedInputText.split(' ');
    const opListFiltered = opList.filter((op) => op.name !== undefined);
    return mainCodes.length !== opListFiltered.length;
  }, [debouncedInputText, opList]);

  return (
    <div
      className="type-and-path mb-2 quick-entry-visual"
      style={{ minWidth: `${monospaceOneCharREMWidth * inputText.length + 5.5}rem` }}
      data-testid="type-and-path-container"
    >
      <div className="input-wrapper">
        <div className="d-flex align-items-center">
          <div
            className={cx('form-control-container', 'flex-grow-1', 'mr-2', {
              'is-invalid': isInvalid,
            })}
          >
            <input
              ref={inputRef}
              className="form-control quick-entry-visual"
              type="text"
              value={inputText}
              onChange={(e) => handleInput(e.target.value, e.target.selectionStart!)}
              placeholder={t('inputOPMainCodesExample')}
              autoFocus
              data-testid="type-and-path-input"
            />
          </div>
          <button
            className="btn btn-success"
            type="button"
            aria-label={t('launchPathFinding')}
            title={t('launchPathFinding')}
            onClick={handleSubmit}
            disabled={isInvalid || opList.length < 2}
            data-testid="submit-search-by-main-code"
          >
            <Rocket />
          </button>
        </div>
      </div>
      {searchResults.length > 0 && isSortedSearchResultsDisplayed && (
        <div className="results-container">
          <div className="station-results p-2 quick-entry-visual">
            {sortedSearchResults.map((result) => (
              <button
                id={`main-code-button-${result.name}`}
                type="button"
                onClick={() => onResultClick(result)}
                key={result.obj_id}
                className="op-suggestion"
                title={`${result.name} ${result.secondary_code}`}
              >
                <span className="op-suggestion-main-code">{result.main_code}</span>
                <span className="op-suggestion-name">{result.name}</span>
              </button>
            ))}
            {sortedSearchResults.length > 8 && (
              <div className="ellipsis-placeholder" title={t('refineSearchForMoreResults')}>
                ...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TypeAndPath;
