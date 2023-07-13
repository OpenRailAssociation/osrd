/* eslint-disable jsx-a11y/no-autofocus */
import {
  Path,
  PostSearchApiArg,
  SearchResultItemOperationalPoint,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { getInfraID, getRollingStockID } from 'reducers/osrdconf/selectors';
import { useDebounce } from 'utils/helpers';
import cx from 'classnames';
import { GoAlert, GoTriangleRight } from 'react-icons/go';
import { loadPathFinding } from 'modules/trainschedule/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import { setFailure } from 'reducers/main';
import bbox from '@turf/bbox';
import { Position } from 'geojson';

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
            >
              {op.name ? op.name : <GoAlert />}
            </div>
          )
        );
      })}
    </div>
  );
}

export default function TypeAndPath({ zoomToFeature }: PathfindingProps) {
  const dispatch = useDispatch();
  const [inputText, setInputText] = useState<string>('');
  const [opList, setOpList] = useState<SearchResultItemOperationalPoint[]>([]);
  const infraId = useSelector(getInfraID);
  const rollingStockId = useSelector(getRollingStockID);
  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const [postPathfinding] = osrdEditoastApi.usePostPathfindingMutation();
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');

  const debouncedInputText = useDebounce(inputText.trimEnd(), 500);

  const handleInput = (text: string) => {
    // setInputText(text.trimStart().toUpperCase());
    setInputText(text.trimStart());
  };

  function getOpNames() {
    if (infraId !== undefined) {
      const opTrigrams = inputText.toUpperCase().split(' ');
      const constraint = opTrigrams.reduce(
        (res, trigram) => [...res, ['=', ['trigram'], trigram]],
        ['or'] as (string | SearchConstraintType)[]
      );
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
        pageSize: 1000,
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

  const isInvalid = !opList.every((op) => op.name || op.trigram === '');

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
      postPathfinding({ pathQuery: params })
        .unwrap()
        .then((itineraryCreated: Path) => {
          zoomToFeature(bbox(itineraryCreated.geographic));
          loadPathFinding(itineraryCreated, dispatch);
        })
        .catch((e) => {
          dispatch(
            setFailure({
              name: e.data.name,
              message: e.data.message,
            })
          );
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
          />
          <span className="form-control-state" />
        </div>
        <button
          className="btn btn-sm btn-success"
          type="button"
          onClick={launchPathFinding}
          disabled={isInvalid}
        >
          <GoTriangleRight />
        </button>
      </div>
    </div>
  );
}
