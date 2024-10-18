import { useMemo } from 'react';

import cx from 'classnames';
import { keyColumn, type Column, checkboxColumn, createTextColumn } from 'react-datasheet-grid';
import type { CellComponent } from 'react-datasheet-grid/dist/types';
import { useTranslation } from 'react-i18next';

import { marginRegExValidation } from '../consts';
import { disabledTextColumn } from '../helpers/utils';
import ReadOnlyTime from '../ReadOnlyTime';
import TimeInput from '../TimeInput';
import { TableType, type TimeExtraDays, type TimeStopsRow } from '../types';

const timeColumn = (isOutputTable: boolean) =>
  ({
    component: (isOutputTable ? ReadOnlyTime : TimeInput) as CellComponent<
      TimeExtraDays | undefined,
      string
    >,
    deleteValue: () => undefined,
    copyValue: ({ rowData }) => rowData?.time ?? null,
    pasteValue: ({ value }) => ({ time: value }),
    minWidth: isOutputTable ? 110 : 170,
    isCellEmpty: ({ rowData }) => !rowData,
  }) as Partial<Column<TimeExtraDays | undefined, string, string>>;

export const useTimeStopsColumns = <T extends TimeStopsRow>(
  tableType: TableType,
  allWaypoints: T[] = []
) => {
  const { t } = useTranslation('timesStops');

  const fixedWidth = (width: number) => ({ minWidth: width, maxWidth: width });

  const columns = useMemo<Column<T>[]>(() => {
    const isOutputTable = tableType === TableType.Output;
    const extraOutputColumns = (
      isOutputTable
        ? [
            {
              ...disabledTextColumn('theoreticalMarginSeconds', t('theoreticalMarginSeconds'), {
                alignRight: true,
              }),
              headerClassName: 'padded-header',
              ...fixedWidth(130),
            },
            {
              ...disabledTextColumn('calculatedMargin', t('realMargin'), {
                alignRight: true,
              }),
              headerClassName: 'padded-header',
              ...fixedWidth(100),
            },
            {
              ...disabledTextColumn('diffMargins', t('diffMargins'), {
                alignRight: true,
              }),
              headerClassName: 'padded-header',
              ...fixedWidth(100),
            },
            {
              ...disabledTextColumn('calculatedArrival', t('calculatedArrivalTime'), {
                alignRight: true,
              }),
              headerClassName: 'padded-header',
              ...fixedWidth(120),
            },
            {
              ...disabledTextColumn('calculatedDeparture', t('calculatedDepartureTime'), {
                alignRight: true,
              }),
              headerClassName: 'padded-header',
              ...fixedWidth(120),
            },
          ]
        : []
    ) as Column<T>[];

    return [
      {
        ...keyColumn('name', createTextColumn()),
        title: t('name'),
        component: isOutputTable
          ? ({ rowData }) => (
              <span
                title={rowData.name}
                className="ml-1 whitespace-nowrap overflow-hidden"
                style={{ whiteSpace: 'nowrap' }}
              >
                {rowData.name}
              </span>
            )
          : undefined,
        disabled: true,
        minWidth: isOutputTable ? undefined : 300,
        maxWidth: isOutputTable ? 560 : undefined,
      },
      {
        ...keyColumn(
          'ch',
          createTextColumn({
            alignRight: true,
          })
        ),
        title: t('ch'),
        disabled: true,
        maxWidth: 45,
      },
      {
        ...keyColumn('arrival', timeColumn(isOutputTable)),
        title: t('arrivalTime'),
        headerClassName: 'padded-header',
        ...fixedWidth(120),

        // We should not be able to edit the arrival time of the origin
        disabled: ({ rowIndex }) => isOutputTable || rowIndex === 0,
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
        headerClassName: 'padded-header',
        disabled: isOutputTable,
        maxWidth: isOutputTable ? 100 : undefined,
        grow: 0.6,
      },
      {
        ...keyColumn('departure', timeColumn(isOutputTable)),
        title: t('departureTime'),
        headerClassName: 'padded-header',
        ...fixedWidth(120),

        // We should not be able to edit the departure time of the origin
        disabled: ({ rowIndex }) => isOutputTable || rowIndex === 0,
      },
      {
        ...keyColumn('onStopSignal', checkboxColumn as Partial<Column<boolean | undefined>>),
        title: t('receptionOnClosedSignal'),
        headerClassName: 'padded-header',
        ...fixedWidth(120),

        // We should not be able to edit the reception on close signal if stopFor is not filled
        // except for the destination
        disabled: ({ rowData, rowIndex }) =>
          isOutputTable || (rowIndex !== allWaypoints.length - 1 && !rowData.stopFor),
      },
      {
        ...keyColumn('shortSlipDistance', checkboxColumn as Partial<Column<boolean | undefined>>),
        title: t('shortSlipDistance'),
        headerClassName: 'padded-header',
        ...fixedWidth(94),
        disabled: ({ rowData, rowIndex }) =>
          isOutputTable || (rowIndex !== allWaypoints.length - 1 && !rowData.onStopSignal),
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
        headerClassName: 'padded-header',
        minWidth: 100,
        maxWidth: 145,
        disabled: ({ rowIndex }) => isOutputTable || rowIndex === allWaypoints.length - 1,
      },
      ...extraOutputColumns,
    ] as Column<T>[];
  }, [tableType, t, allWaypoints.length]);

  return columns;
};

export default timeColumn;
