/* eslint-disable jsx-a11y/no-autofocus */
import { useEffect, useMemo, useRef, useState } from 'react';

import { Alert, Rocket, TriangleRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { v4 as uuidV4 } from 'uuid';

import { useManageTrainScheduleContext } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import type {
  PostSearchApiArg,
  SearchPayload,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID } from 'common/osrdContext';
import type { PathStep } from 'reducers/osrdconf/types';
import { useDebounce } from 'utils/hooks/useDebounce';
import {
  isCursorSurroundedBySpace,
  findCurrentWord,
  calculateAdjustedCursorPositionRem,
  replaceCurrentWord,
} from 'utils/inputManipulation';

type SearchConstraintType = (string | number | string[])[];

const monospaceOneCharREMWidth = 0.6225;

function OpTooltips({ opList }: { opList: SearchResultItemOperationalPoint[] }) {
  // Calculation of chars distance from left to put tooltip on center of op name
  const calcLeftMargin = (charsFromLeft: number, length: number) =>
    charsFromLeft * monospaceOneCharREMWidth + (length * monospaceOneCharREMWidth) / 2;
  let charsFromLeft = 0;
  return (
    <div className="op-tooltips">
      {opList.map((op, idx) => {
        const leftMargin = calcLeftMargin(charsFromLeft, op.main_code.length);
        // TODO: fix this lint
        // eslint-disable-next-line react-hooks-js/immutability
        charsFromLeft = charsFromLeft + op.main_code.length + 1;
        return (
          op.main_code !== '' && (
            <div
              className={cx('op', { wrong: !op.name })}
              key={`typeandpath-op-${idx}-${op.main_code}`}
              style={{ left: `${leftMargin}rem` }}
              title={op.name}
              data-testid={`typeandpath-op-${op.main_code}`}
            >
              {op.name ? op.name : <Alert />}
            </div>
          )
        );
      })}
    </div>
  );
}
type TypeAndPathProps = {
  setDisplayTypeAndPath?: React.Dispatch<React.SetStateAction<boolean>>;
  isInNewModal?: boolean;
};

const TypeAndPath = ({ setDisplayTypeAndPath, isInNewModal = false }: TypeAndPathProps) => {
  const { launchPathfinding } = useManageTrainScheduleContext();

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
      // WARN PathItem => PathStep
      const pathSteps: PathStep[] = opList
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
        }));

      setDisplayTypeAndPath?.(false);
      launchPathfinding(pathSteps);
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
      className={cx('type-and-path mb-2', { 'quick-entry-visual': isInNewModal })}
      style={{ minWidth: `${monospaceOneCharREMWidth * inputText.length + 5.5}rem` }}
      data-testid="type-and-path-container"
    >
      {!isInNewModal && <div className="help">{opList.length === 0 && t('inputOPMainCodes')}</div>}
      <div className="input-wrapper">
        {!isInNewModal && <OpTooltips opList={opList} />}
        <div className="d-flex align-items-center">
          <div
            className={cx('form-control-container', 'flex-grow-1', 'mr-2', {
              'is-invalid': isInvalid,
            })}
          >
            <input
              ref={inputRef}
              className={cx('form-control', {
                'form-control-sm text-zone': !isInNewModal,
                'quick-entry-visual': isInNewModal,
              })}
              type="text"
              value={inputText}
              onChange={(e) => handleInput(e.target.value, e.target.selectionStart!)}
              placeholder={t('inputOPMainCodesExample')}
              autoFocus
              data-testid="type-and-path-input"
            />
            {!isInNewModal && <span className="form-control-state" />}
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
            {isInNewModal ? <Rocket /> : <TriangleRight />}
          </button>
        </div>
      </div>
      {searchResults.length > 0 && isSortedSearchResultsDisplayed && (
        <>
          {!isInNewModal && <span className="arrow-img"> </span>}
          <div className="results-container">
            <div className={cx('station-results p-2', { 'quick-entry-visual': isInNewModal })}>
              {sortedSearchResults.map((result) => (
                <button
                  id={`main-code-button-${result.name}`}
                  type="button"
                  onClick={() => onResultClick(result)}
                  key={result.obj_id}
                  className={cx({
                    station: !isInNewModal,
                    'op-suggestion': isInNewModal,
                  })}
                  title={`${result.name} ${result.secondary_code}`}
                >
                  {isInNewModal && (
                    <span className="op-suggestion-main-code">{result.main_code}</span>
                  )}
                  <span
                    className={cx({
                      'station-text text-secondary': !isInNewModal,
                      'op-suggestion-name': isInNewModal,
                    })}
                  >
                    {result.name}
                  </span>
                </button>
              ))}
              {sortedSearchResults.length > 8 && (
                <div className="ellipsis-placeholder" title={t('refineSearchForMoreResults')}>
                  ...
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TypeAndPath;
