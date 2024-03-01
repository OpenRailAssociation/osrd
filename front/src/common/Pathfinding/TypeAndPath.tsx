/* eslint-disable jsx-a11y/no-autofocus */
import React, { useEffect, useMemo, useState } from 'react';

import { Alert, TriangleRight } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import cx from 'classnames';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type {
  PathResponse,
  PostSearchApiArg,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { loadPathFinding } from 'modules/trainschedule/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';

type SearchConstraintType = (string | number | string[])[];
type PathfindingProps = {
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
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

export default function TypeAndPath({ zoomToFeature }: PathfindingProps) {
  const dispatch = useAppDispatch();
  const [inputText, setInputText] = useState('');
  const [opList, setOpList] = useState<SearchResultItemOperationalPoint[]>([]);
  const { getRollingStockID } = useOsrdConfSelectors();
  const infraId = useInfraID();
  const rollingStockId = useSelector(getRollingStockID);
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [postPathfinding] = osrdEditoastApi.endpoints.postPathfinding.useMutation();
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const osrdActions = useOsrdConfActions();

  const debouncedInputText = useDebounce(inputText.trimEnd(), 500);

  const handleInput = (text: string) => {
    setInputText(text.trimStart());
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

  function launchPathFinding() {
    if (infraId && rollingStockId && opList.length > 0) {
      const params = {
        infra: infraId,
        rolling_stocks: [rollingStockId],
        steps: opList
          .filter((op) => op.trigram !== '')
          .map((op) => ({
            duration: 0,
            waypoints: op.track_sections.map((position) => ({
              track_section: position.track,
              offset: position.position,
            })),
          })),
      };
      postPathfinding({ pathfindingRequest: params })
        .unwrap()
        .then((itineraryCreated: PathResponse) => {
          zoomToFeature(bbox(itineraryCreated.geographic));
          loadPathFinding(itineraryCreated, dispatch, osrdActions);
        })
        .catch((e) => {
          dispatch(setFailure(castErrorToFailure(e)));
        });
    }
  }

  useEffect(() => {
    if (debouncedInputText !== '') {
      getOpNames();
    } else {
      setOpList([]);
    }
  }, [debouncedInputText]);

  return (
    <div
      className="type-and-path"
      style={{ minWidth: `${monospaceOneCharREMWidth * inputText.length + 5.5}rem` }} // To grow input field & whole div along text size
      data-testid="type-and-path-container"
    >
      <div className="help">{opList.length === 0 && t('inputOPTrigrams')}</div>
      <OpTooltips opList={opList} />
      <div className="d-flex align-items-center">
        <div
          className={cx('form-control-container', 'flex-grow-1', 'mr-2', {
            'is-invalid': isInvalid,
          })}
        >
          <input
            className="form-control form-control-sm text-zone"
            type="text"
            value={inputText}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={t('inputOPTrigramsExample')}
            autoFocus
            data-testid="type-and-path-input"
          />
          <span className="form-control-state" />
        </div>
        <button
          className="btn btn-sm btn-success"
          type="button"
          aria-label={t('launchPathFinding')}
          title={t('launchPathFinding')}
          onClick={launchPathFinding}
          disabled={isInvalid || opList.length < 2}
          data-testid="submit-search-by-trigram"
        >
          <TriangleRight />
        </button>
      </div>
    </div>
  );
}
