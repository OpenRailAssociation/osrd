import React, { useMemo, useState, useEffect } from 'react';

import type { TFunction } from 'i18next';
import { compact } from 'lodash';
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

import timeColumn from './TimeColumnComponent';

type TimesStopsProps = {
  pathProperties: ManageTrainSchedulePathProperties;
  pathSteps?: (PathStep | null)[];
};

type PathWaypointColumn = SuggestedOP & {
  isMarginValid: boolean;
};

const marginRegExValidation = /^\d+(\.\d+)?%$|^\d+(\.\d+)?min\/100km$/;

const formatSuggestedViasToRowVias = (
  operationalPoints: SuggestedOP[],
  t: TFunction<'timesStops', undefined>
): PathWaypointColumn[] =>
  operationalPoints?.map((op) => ({
    ...op,
    name: op.name || t('waypoint', { id: op.opId }),
    isMarginValid: op.theoreticalMargin ? marginRegExValidation.test(op.theoreticalMargin) : true,
    onStopSignal: op.onStopSignal || false,
  }));

const createDeleteViaButton = ({
  removeVia,
  isRowVia,
}: {
  removeVia: () => void;
  isRowVia: boolean;
}) => {
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

const TimesStops = ({ pathProperties, pathSteps = [] }: TimesStopsProps) => {
  const { t } = useTranslation('timesStops');
  const dispatch = useAppDispatch();
  const { upsertViaFromSuggestedOP, updatePathSteps } = useOsrdConfActions();

  const [timesStopsSteps, setTimesStopsSteps] = useState<PathWaypointColumn[]>([]);

  useEffect(() => {
    const suggestedOPs = formatSuggestedViasToRowVias(pathProperties.allVias, t);
    setTimesStopsSteps(suggestedOPs);
  }, [t, pathProperties.allVias]);

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

        // We should not be edit the arrival time of the origin
        cellClassName: ({ rowIndex }) => (rowIndex === 0 ? 'dsg-hidden-cell' : ''),
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
        grow: 0.6,
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
        disabled: ({ rowIndex }) => rowIndex === pathProperties.allVias.length - 1,
      },
    ],
    [t, pathProperties.allVias.length]
  );

  const removeVia = (rowData: PathWaypointColumn) => {
    const index = compact(pathSteps).findIndex((step) => {
      if ('uic' in step) {
        return step.uic === rowData.uic && step.ch === rowData.ch && step.kp === rowData.kp;
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
        if (rowData.theoreticalMargin && !marginRegExValidation.test(rowData.theoreticalMargin!)) {
          rowData.isMarginValid = false;
          setTimesStopsSteps(row);
        } else {
          rowData.isMarginValid = true;
          dispatch(upsertViaFromSuggestedOP(rowData as SuggestedOP));
        }
      }}
      stickyRightColumn={{
        component: ({ rowData }) =>
          createDeleteViaButton({
            removeVia: () => removeVia(rowData),
            isRowVia: isVia(compact(pathSteps), rowData),
          }),
      }}
      lockRows
      height={600}
      rowClassName={({ rowData, rowIndex }) =>
        rowIndex === 0 ||
        rowIndex === pathProperties.allVias.length - 1 ||
        isVia(compact(pathSteps), rowData)
          ? 'activeRow'
          : ''
      }
    />
  );
};

export default TimesStops;
