import { useMemo } from 'react';

import cx from 'classnames';
import { keyColumn, type Column, checkboxColumn, createTextColumn } from 'react-datasheet-grid';
import type { CellComponent } from 'react-datasheet-grid/dist/types';
import { useTranslation } from 'react-i18next';

import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';

import { marginRegExValidation } from '../consts';
import { disabledTextColumn } from '../helpers/utils';
import TimeInput from '../TimeInput';
import { TableType, type PathWaypointRow } from '../types';

const timeColumn: Partial<Column<string | null | undefined, string, string>> = {
  component: TimeInput as CellComponent<string | null | undefined, string>,
  deleteValue: () => null,
  copyValue: ({ rowData }) => rowData ?? null,
  pasteValue: ({ value }) => value,
  minWidth: 170,
  isCellEmpty: ({ rowData }) => !rowData,
};

const fixedWidth = (width: number) => ({ minWidth: width, maxWidth: width });

export const useTimeStopsColumns = (tableType: TableType, allWaypoints: SuggestedOP[] = []) => {
  const { t } = useTranslation('timesStops');
  const columns = useMemo<Column<PathWaypointRow>[]>(() => {
    const isOutputTable = tableType === TableType.Output;
    const extraOutputColumns = (
      isOutputTable
        ? [
            {
              ...disabledTextColumn('theoreticalMarginSeconds', t('theoreticalMarginSeconds'), {
                alignRight: true,
              }),
              ...fixedWidth(110),
            },
            {
              ...disabledTextColumn('calculatedMargin', t('realMargin'), {
                alignRight: true,
              }),
              ...fixedWidth(120),
            },
            {
              ...disabledTextColumn('diffMargins', t('diffMargins'), { alignRight: true }),
              ...fixedWidth(120),
            },
            {
              ...disabledTextColumn('calculatedArrival', t('calculatedArrivalTime')),
              ...fixedWidth(95),
            },
            {
              ...disabledTextColumn('calculatedDeparture', t('calculatedDepartureTime')),
              ...fixedWidth(97),
            },
          ]
        : []
    ) as Column<PathWaypointRow>[];
    return [
      {
        ...keyColumn('name', createTextColumn()),
        title: t('name'),
        disabled: true,
        minWidth: isOutputTable ? 180 : 300,
      },
      {
        ...keyColumn('ch', createTextColumn()),
        title: 'Ch',
        disabled: true,
        maxWidth: 45,
      },
      {
        ...keyColumn('arrival', isOutputTable ? createTextColumn() : timeColumn),
        title: t('arrivalTime'),

        // We should not be able to edit the arrival time of the origin
        disabled: ({ rowIndex }) => isOutputTable || rowIndex === 0,
        maxWidth: isOutputTable ? 90 : undefined,
      },
      {
        ...keyColumn(
          'stopFor',
          createTextColumn({
            continuousUpdates: false,
            alignRight: true,
          })
        ),
        title: t('stopTime'),
        disabled: isOutputTable,
        maxWidth: isOutputTable ? 90 : undefined,
        grow: 0.6,
      },
      {
        ...keyColumn('onStopSignal', checkboxColumn as Partial<Column<boolean | undefined>>),
        title: t('receptionOnClosedSignal'),

        // We should not be able to edit the reception on close signal if stopFor is not filled
        // except for the destination
        ...fixedWidth(120),
        disabled: ({ rowData, rowIndex }) =>
          isOutputTable || (rowIndex !== allWaypoints?.length - 1 && !rowData.stopFor),
      },
      {
        ...keyColumn(
          'theoreticalMargin',
          createTextColumn({
            continuousUpdates: false,
            alignRight: true,
            placeholder: !isOutputTable ? t('theoreticalMarginPlaceholder') : '',
            formatBlurredInput: (value) => {
              if (!value || value === '0%') return '';
              if (!isOutputTable && !marginRegExValidation.test(value)) {
                return `${value}${t('theoreticalMarginPlaceholder')}`;
              }
              return value;
            },
          })
        ),
        cellClassName: ({ rowData }) =>
          cx({ invalidCell: !isOutputTable && !rowData.isMarginValid }),
        title: t('theoreticalMargin'),
        disabled: ({ rowIndex }) => isOutputTable || rowIndex === allWaypoints.length - 1,
        ...fixedWidth(110),
      },
      ...extraOutputColumns,
    ] as Column<PathWaypointRow>[];
  }, [tableType, t, allWaypoints.length]);
  return columns;
};

export default timeColumn;
