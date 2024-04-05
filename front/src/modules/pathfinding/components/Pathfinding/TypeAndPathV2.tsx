/* eslint-disable jsx-a11y/no-autofocus */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Alert, TriangleRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import type {
  PostSearchApiArg,
  PostV2InfraByInfraIdPathPropertiesApiArg,
  PostV2InfraByInfraIdPathfindingBlocksApiArg,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfActions } from 'common/osrdContext';
import { formatSuggestedOperationalPoints } from 'modules/pathfinding/utils';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { getSupportedElectrification, isThermal } from 'modules/rollingStock/helpers/electric';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { setFailure } from 'reducers/main';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';
import {
  isCursorSurroundedBySpace,
  findCurrentWord,
  calculateAdjustedCursorPositionRem,
  replaceCurrentWord,
} from 'utils/inputManipulation';

type SearchConstraintType = (string | number | string[])[];
type PathfindingProps = {
  setPathProperties: (pathProperties: ManageTrainSchedulePathProperties) => void;
};

const monospaceOneCharREMWidth = 0.6225;

function OpTooltips({ opList }: { opList: SearchResultItemOperationalPoint[] }) {
  // Calculation of chars distance from left to put tooltip on center of op name
  const calcLeftMargin = (charsFromLeft: number, length: number) =>
    charsFromLeft * monospaceOneCharREMWidth + (length * monospaceOneCharREMWidth) / 2;
  let charsFromLeft = 0;
  return (
    <div className="op-tooltips">
      {opList.map((op, idx) => {
        const leftMargin = calcLeftMargin(charsFromLeft, op.trigram.length);
        charsFromLeft = charsFromLeft + op.trigram.length + 1;
        return (
          op.trigram !== '' && (
            <div
              className={cx('op', { wrong: !op.name })}
              key={`typeandpath-op-${idx}-${op.trigram}`}
              style={{ left: `${leftMargin}rem` }}
              title={op.name}
              data-testid={`typeandpath-op-${op.trigram}`}
            >
              {op.name ? op.name : <Alert />}
            </div>
          )
        );
      })}
    </div>
  );
}

const TypeAndPathV2 = ({ setPathProperties }: PathfindingProps) => {
  const dispatch = useAppDispatch();
  const [inputText, setInputText] = useState('');
  const [opList, setOpList] = useState<SearchResultItemOperationalPoint[]>([]);
  const infraId = useInfraID();
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [postPathfindingBlocks] =
    osrdEditoastApi.endpoints.postV2InfraByInfraIdPathfindingBlocks.useMutation();
  const [postPathProperties] =
    enhancedEditoastApi.endpoints.postV2InfraByInfraIdPathProperties.useMutation();

  const { t: tManageTrainSchedule } = useTranslation('operationalStudies/manageTrainSchedule');
  const { t: tTypeAndPath } = useTranslation('common/typeAndPath');

  const { rollingStock } = useStoreDataForRollingStockSelector();
  const { updatePathSteps } = useOsrdConfActions();

  const [searchResults, setSearchResults] = useState<SearchResultItemOperationalPoint[]>([]);
  const [searchState, setSearch] = useState('');
  const mainOperationalPointsCHCodes = ['', '00', 'BV'];
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearchTerm = useDebounce(searchState, 300);
  const debouncedInputText = useDebounce(inputText.trimEnd(), 500);

  const activeElement = document.activeElement as HTMLInputElement;
  const cursorIndex = activeElement.selectionStart || 0;
  const sortedSearchResults = [...searchResults].sort((a, b) => a.name.localeCompare(b.name));
  const [initialCursorPositionRem, setInitialCursorPositionRem] = useState(0);
  const [trigramCount, setTrigramCount] = useState(0);
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

    const payload = {
      object: 'operationalpoint',
      query: ['and', searchQuery, infraId !== undefined ? ['=', ['infra_id'], infraId] : true],
    };

    await postSearch({
      searchPayload: payload,
      pageSize: 101,
    })
      .unwrap()
      .then((results) => {
        const filteredResults = results.filter((result) =>
          mainOperationalPointsCHCodes.includes((result as SearchResultItemOperationalPoint).ch)
        );
        setSearchResults(filteredResults as SearchResultItemOperationalPoint[]);
      })
      .catch(() => {
        setSearchResults([]);
      });
  };

  function getOpNames() {
    if (infraId !== undefined) {
      const opTrigrams = inputText.toUpperCase().trimEnd().split(' ');
      const constraint = opTrigrams.reduce(
        (res, trigram) => [...res, ['=', ['trigram'], trigram]],
        ['or'] as (string | SearchConstraintType)[]
      );
      // SNCF trigrams come with a yard name, for main station it could be nothing '',
      // 'BV' (as Bâtiment Voyageurs) or '00', all are the same signification: this is the main station.
      const limitToMainStationConstraint = [
        'or',
        ['=', ['ch'], ''],
        ['=', ['ch'], 'BV'],
        ['=', ['ch'], '00'],
      ];
      const payload: PostSearchApiArg = {
        searchPayload: {
          object: 'operationalpoint',
          query: ['and', constraint, ['=', ['infra_id'], infraId], limitToMainStationConstraint],
        },
        pageSize: 100,
      };
      postSearch(payload)
        .unwrap()
        .then((results) => {
          const operationalPoints = [...results] as SearchResultItemOperationalPoint[];
          setOpList(
            opTrigrams.map(
              (trigram) => operationalPoints.find((op) => op.trigram === trigram) || { trigram }
            ) as SearchResultItemOperationalPoint[]
          );
        });
    }
  }

  const isInvalid = useMemo(() => opList.some((op) => !op.name && op.trigram !== ''), [opList]);

  const launchPathFinding = async () => {
    if (infraId && rollingStock && opList.length > 0) {
      const pathItems = opList
        .filter((op) => op.trigram !== '')
        .map(({ uic, ch }) => ({
          uic,
          secondary_code: ch,
        }));

      const params: PostV2InfraByInfraIdPathfindingBlocksApiArg = {
        infraId,
        pathfindingInputV2: {
          path_items: pathItems,
          rolling_stock_is_thermal: isThermal(rollingStock.effort_curves.modes),
          rolling_stock_loading_gauge: rollingStock.loading_gauge,
          rolling_stock_supported_electrifications: getSupportedElectrification(
            rollingStock.effort_curves.modes
          ),
          rolling_stock_supported_signaling_systems: rollingStock.supported_signaling_systems,
        },
      };

      try {
        const pathfindingResult = await postPathfindingBlocks(params).unwrap();

        if (pathfindingResult.status === 'success') {
          const pathPropertiesParams: PostV2InfraByInfraIdPathPropertiesApiArg = {
            infraId,
            props: ['electrifications', 'geometry', 'operational_points'],
            pathPropertiesInput: {
              track_section_ranges: pathfindingResult.track_section_ranges,
            },
          };
          const { electrifications, geometry, operational_points } =
            await postPathProperties(pathPropertiesParams).unwrap();

          if (electrifications && geometry && operational_points) {
            const suggestedOperationalPoints: SuggestedOP[] = formatSuggestedOperationalPoints(
              operational_points,
              geometry,
              pathfindingResult.length
            );

            setPathProperties({
              electrifications,
              geometry,
              suggestedOperationalPoints,
              allVias: suggestedOperationalPoints,
              length: pathfindingResult.length,
            });
          }

          const pathSteps: PathStep[] = opList.map((op, i) => ({
            id: nextId(),
            uic: op.uic,
            name: op.name,
            ch: op.ch,
            coordinates: op.geographic.coordinates,
            positionOnPath: pathfindingResult.path_items_positions[i],
          }));
          dispatch(updatePathSteps(pathSteps));
        }
        // TODO TS2 : test errors display after core / editoast connexion for pathProperties
      } catch (e) {
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  };

  const onResultClick = (result: SearchResultItemOperationalPoint) => {
    const newText = replaceCurrentWord(inputText, cursorPosition, result);

    setInputText(newText);
    setSearch('');
    setTrigramCount((prev) => prev + 1);

    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPosition = newText.length;
        inputRef.current.focus();
        inputRef.current.selectionStart = newCursorPosition;
        inputRef.current.selectionEnd = newCursorPosition;
        const adjustedCursorPositionRem = calculateAdjustedCursorPositionRem(
          initialCursorPositionRem,
          trigramCount,
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

  return (
    <>
      <div
        className="type-and-path mb-2"
        style={{ minWidth: `${monospaceOneCharREMWidth * inputText.length + 5.5}rem` }} // To grow input field & whole div along text size
        data-testid="type-and-path-container"
      >
        <div className="help">{opList.length === 0 && tManageTrainSchedule('inputOPTrigrams')}</div>
        <OpTooltips opList={opList} />
        <div className="d-flex align-items-center">
          <div
            className={cx('form-control-container', 'flex-grow-1', 'mr-2', {
              'is-invalid': isInvalid,
            })}
          >
            <input
              ref={inputRef}
              className="form-control form-control-sm text-zone"
              type="text"
              value={inputText}
              onChange={(e) => handleInput(e.target.value, e.target.selectionStart as number)}
              placeholder={tManageTrainSchedule('inputOPTrigramsExample')}
              autoFocus
              data-testid="type-and-path-input"
            />
            <span className="form-control-state" />
          </div>
          <button
            className="btn btn-sm btn-success"
            type="button"
            aria-label={tManageTrainSchedule('launchPathFinding')}
            title={tManageTrainSchedule('launchPathFinding')}
            onClick={launchPathFinding}
            disabled={isInvalid || opList.length < 2}
            data-testid="submit-search-by-trigram"
          >
            <TriangleRight />
          </button>
        </div>
      </div>
      {searchResults.length > 0 && (
        <>
          <span className="arrow-img"> </span>
          <div className="results-container">
            <div className="station-results  p-2 ">
              {sortedSearchResults.map((result) => (
                <button
                  id={`trigram-button-${result.name}`}
                  type="button"
                  onClick={() => onResultClick(result)}
                  key={result.obj_id}
                  className="station"
                  title={`${result.name} ${result.ch}`}
                >
                  <span className="station-text text-secondary ">{result.name}</span>
                </button>
              ))}
              {sortedSearchResults.length > 8 && (
                <div
                  className="ellipsis-placeholder"
                  title={tTypeAndPath('refineSearchForMoreResults')}
                >
                  ...
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default TypeAndPathV2;
