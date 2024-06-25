import React, { useMemo, useState, useEffect } from 'react';

import {
  keyColumn,
  type Column,
  checkboxColumn,
  createTextColumn,
  DynamicDataSheetGrid,
} from 'react-datasheet-grid';
import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { useOsrdConfActions } from 'common/osrdContext';
import { isVia } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { removeElementAtIndex } from 'utils/array';

import { marginRegExValidation } from './consts';
import timeColumn from './TimeColumnComponent';
import type { PathWaypointColumn } from './types';
import { formatSuggestedViasToRowVias } from './utils';

const WITH_KP = true;

type TimesStopsProps = {
  pathProperties: ManageTrainSchedulePathProperties | undefined;
  pathSteps?: PathStep[];
  startTime?: string;
};

const createDeleteViaButton = ({
  removeVia,
  rowIndex,
  rowData,
  pathProperties,
  pathSteps,
}: {
  removeVia: () => void;
  rowIndex: number;
  rowData: PathWaypointColumn;
  pathProperties: ManageTrainSchedulePathProperties;
  pathSteps: PathStep[];
}) => {
  const isRowVia =
    rowIndex !== 0 &&
    rowIndex !== pathProperties.allWaypoints?.length - 1 &&
    isVia(pathSteps, rowData, WITH_KP);
  if (isRowVia) {
    return (
      <button type="button" onClick={removeVia}>
        ❌
      </button>
    );
  }
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <></>;
};

const TimesStops = ({ pathProperties, pathSteps = [], startTime }: TimesStopsProps) => {
  const { t } = useTranslation('timesStops');

  if (!pathProperties) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <p className="pt-1 px-5">{t('noPathLoaded')}</p>
      </div>
    );
  }

  const dispatch = useAppDispatch();
  const { upsertViaFromSuggestedOP, updatePathSteps } = useOsrdConfActions();

  const [timesStopsSteps, setTimesStopsSteps] = useState<PathWaypointColumn[]>([]);

  useEffect(() => {
    const suggestedOPs = formatSuggestedViasToRowVias(
      pathProperties.allWaypoints,
      pathSteps,
      t,
      startTime
    );
    setTimesStopsSteps(suggestedOPs);
  }, [t, pathProperties.allWaypoints, startTime]);

  const columns: Column<PathWaypointColumn>[] = useMemo(
    () => [
      {
        ...keyColumn<PathWaypointColumn, 'name'>('name', createTextColumn()),
        title: t('name'),
        disabled: true,
      },
      {
        ...keyColumn<PathWaypointColumn, 'ch'>('ch', createTextColumn()),
        title: 'Ch',
        disabled: true,
        grow: 0.1,
      },
      {
        ...keyColumn<PathWaypointColumn, 'arrival'>('arrival', timeColumn),
        title: t('arrivalTime'),

        // We should not be able to edit the arrival time of the origin
        disabled: ({ rowIndex }) => rowIndex === 0,
        grow: 0.6,
      },
      {
        ...keyColumn<PathWaypointColumn, 'stopFor'>(
          'stopFor',
          createTextColumn({
            continuousUpdates: false,
            alignRight: true,
          })
        ),
        title: `${t('stopTime')}`,
        grow: 0.6,
      },
      {
        ...keyColumn<PathWaypointColumn, 'onStopSignal'>(
          'onStopSignal',
          checkboxColumn as Partial<Column<boolean | undefined>>
        ),
        title: t('receptionOnClosedSignal'),

        // We should not be able to edit the reception on close signal if stopFor is not filled
        // except for the destination
        grow: 0.6,
        disabled: ({ rowData, rowIndex }) =>
          rowIndex !== pathProperties.allWaypoints?.length - 1 && !rowData.stopFor,
      },
      {
        ...keyColumn<PathWaypointColumn, 'theoreticalMargin'>(
          'theoreticalMargin',
          createTextColumn({
            continuousUpdates: false,
            alignRight: true,
            placeholder: t('theoreticalMarginPlaceholder'),
            formatBlurredInput: (value) => {
              if (!value || value === 'none') return '';
              if (!marginRegExValidation.test(value)) {
                return `${value}${t('theoreticalMarginPlaceholder')}`;
              }
              return value;
            },
          })
        ),
        cellClassName: ({ rowData }) => (rowData.isMarginValid ? '' : 'invalidCell'),
        title: t('theoreticalMargin'),
        disabled: ({ rowIndex }) => rowIndex === pathProperties.allWaypoints.length - 1,
      },
    ],
    [t, pathProperties.allWaypoints.length]
  );

  const removeVia = (rowData: PathWaypointColumn) => {
    const index = pathSteps.findIndex((step) => {
      if ('uic' in step) {
        return step.uic === rowData.uic && step.ch === rowData.ch && step.name === rowData.name;
      }
      if ('track' in step) {
        return step.track === rowData.track;
      }
      return false;
    });
    const updatedPathSteps = removeElementAtIndex(pathSteps, index);

    dispatch(updatePathSteps(updatedPathSteps));
  };

  return (
    <DynamicDataSheetGrid
      columns={columns}
      value={timesStopsSteps}
      onChange={(row, [op]) => {
        const rowData = row[`${op.fromRowIndex}`];
        if (!rowData.stopFor && op.fromRowIndex !== pathProperties.allWaypoints.length - 1) {
          rowData.onStopSignal = false;
        }
        if (rowData.theoreticalMargin && !marginRegExValidation.test(rowData.theoreticalMargin!)) {
          rowData.isMarginValid = false;
          setTimesStopsSteps(row);
        } else {
          rowData.isMarginValid = true;
          if (op.fromRowIndex === 0) rowData.arrival = null;
          dispatch(upsertViaFromSuggestedOP(rowData as SuggestedOP));
        }
      }}
      stickyRightColumn={{
        component: ({ rowData, rowIndex }) =>
          createDeleteViaButton({
            removeVia: () => removeVia(rowData),
            rowIndex,
            rowData,
            pathProperties,
            pathSteps,
          }),
      }}
      lockRows
      height={600}
      rowClassName={({ rowData, rowIndex }) =>
        rowIndex === 0 ||
        rowIndex === pathProperties.allWaypoints.length - 1 ||
        isVia(pathSteps, rowData, WITH_KP)
          ? 'activeRow'
          : ''
      }
    />
  );
};

export default TimesStops;
