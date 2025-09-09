import { useMemo } from 'react';

import {
  keyColumn,
  type Column,
  checkboxColumn,
  createTextColumn,
} from '@sdziadkowiec/react-datasheet-grid';
import type { CellComponent } from '@sdziadkowiec/react-datasheet-grid/dist/types';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { useDateTimeLocale } from 'utils/date';
import { Duration } from 'utils/duration';
import { NO_BREAK_SPACE } from 'utils/strings';

import { marginRegExValidation } from '../consts';
import { disabledTextColumn } from '../helpers/utils';
import ReadOnlyTime from '../ReadOnlyTime';
import TimeInput from '../TimeInput';
import { TableType, type TimeExtraDays, type TimesStopsRow } from '../types';

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

function durationColumn() {
  const format = (duration: Duration | null | undefined) => String(duration?.total('second') ?? '');
  const parse = (text: string) => {
    // Remove trailing "s" unit, if any
    const seconds = Number(text.trim().replace(/ *s$/i, ''));
    return !isNaN(seconds) ? new Duration({ seconds }) : null;
  };

  return createTextColumn<Duration | null | undefined>({
    formatBlurredInput: format,
    formatInputOnFocus: format,
    formatForCopy: format,
    parseUserInput: parse,
    parsePastedValue: parse,
    continuousUpdates: false,
    alignRight: true,
  });
}

function readOnlyTimeColumn(key: string, dateTimeLocale: Intl.Locale) {
  const format = (date: Date | undefined) => date?.toLocaleTimeString(dateTimeLocale) ?? '';

  return {
    ...keyColumn(
      key,
      createTextColumn<Date | undefined>({
        formatBlurredInput: format,
        formatInputOnFocus: format,
        formatForCopy: format,
      })
    ),
    disabled: true,
  };
}

const fixedWidth = (width: number) => ({ minWidth: width, maxWidth: width });

function headerWithTitleTagIfShortened(shortenedHeader: string, fullHeader: string) {
  if (shortenedHeader === fullHeader) return fullHeader;
  return <span title={fullHeader}> {shortenedHeader} </span>;
}

export const useTimesStopsColumns = <T extends TimesStopsRow>(
  tableType: TableType,
  allWaypoints: T[] = []
) => {
  const { t } = useTranslation('translation', { keyPrefix: 'timeStopTable' });
  const dateTimeLocale = useDateTimeLocale();

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
              ...fixedWidth(90),
            },
            {
              ...disabledTextColumn('calculatedMargin', t('realMargin'), { alignRight: true }),
              headerClassName: 'padded-header',
              ...fixedWidth(90),
            },
            {
              ...disabledTextColumn('diffMargins', t('diffMargins'), { alignRight: true }),
              title: headerWithTitleTagIfShortened(t('diffMargins'), t('diffMarginsFull')),
              headerClassName: 'padded-header',
              ...fixedWidth(90),
            },
            {
              ...readOnlyTimeColumn('calculatedArrival', dateTimeLocale),
              title: t('calculatedArrivalTime'),
              headerClassName: 'padded-header',
              ...fixedWidth(105),
            },
            {
              ...readOnlyTimeColumn('calculatedDeparture', dateTimeLocale),
              title: headerWithTitleTagIfShortened(
                t('calculatedDepartureTime'),
                t('calculatedDepartureTimeFull')
              ),
              headerClassName: 'padded-header',
              ...fixedWidth(105),
            },
          ]
        : []
    ) as Column<T>[];

    return [
      {
        ...keyColumn('name', createTextColumn()),
        title: t('name'),
        ...(isOutputTable && {
          component: ({ rowData }) => (
            <span
              title={rowData.name}
              className="align-right-responsive m-2 text-nowrap overflow-hidden"
            >
              {rowData.name}
            </span>
          ),
        }),
        disabled: true,
        minWidth: isOutputTable ? undefined : 300,
      },
      {
        ...keyColumn('ch', createTextColumn()),
        title: t('ch'),
        disabled: true,
        ...fixedWidth(45),
      },
      {
        ...keyColumn('trackName', createTextColumn()),
        title: t('trackName'),
        ...(isOutputTable && {
          component: ({ rowData }) => (
            <span title={rowData.trackName} className="ml-2 text-nowrap overflow-hidden">
              {rowData.trackName}
            </span>
          ),
        }),
        disabled: true,
        ...fixedWidth(70),
      },
      {
        ...keyColumn('arrival', timeColumn(isOutputTable)),
        title: t('arrivalTime'),
        headerClassName: 'padded-header',
        ...fixedWidth(isOutputTable ? 105 : 125),

        // We should not be able to edit the arrival time of the origin
        disabled: ({ rowIndex }) => isOutputTable || rowIndex === 0,
      },
      {
        ...keyColumn('stopFor', durationColumn()),
        title: t('stopTime'),
        headerClassName: 'padded-header',
        disabled: isOutputTable,
        ...fixedWidth(80),
      },
      {
        ...keyColumn('departure', timeColumn(isOutputTable)),
        title: headerWithTitleTagIfShortened(t('departureTime'), t('departureTimeFull')),
        headerClassName: 'padded-header',
        ...fixedWidth(isOutputTable ? 105 : 125),

        // We should not be able to edit the departure time of the origin
        disabled: ({ rowIndex }) => isOutputTable || rowIndex === 0,
      },
      {
        ...keyColumn('onStopSignal', checkboxColumn as Partial<Column<boolean | undefined>>),
        title: headerWithTitleTagIfShortened(
          t('receptionOnClosedSignal'),
          t('receptionOnClosedSignalFull')
        ),
        headerClassName: 'padded-header',
        ...fixedWidth(81),

        // We should not be able to edit the reception on close signal if stopFor is not filled
        // except for the destination
        disabled: ({ rowData, rowIndex }) =>
          isOutputTable || (rowIndex !== allWaypoints.length - 1 && !rowData.stopFor),
      },
      {
        ...keyColumn('shortSlipDistance', checkboxColumn as Partial<Column<boolean | undefined>>),
        title: t('shortSlipDistance'),
        headerClassName: 'padded-header',
        ...fixedWidth(81),
        disabled: ({ rowData, rowIndex }) =>
          isOutputTable || (rowIndex !== allWaypoints.length - 1 && !rowData.onStopSignal),
      },
      {
        ...keyColumn(
          'theoreticalMargin',
          createTextColumn({
            continuousUpdates: false,
            placeholder: !isOutputTable ? t('theoreticalMarginPlaceholder') : '',
            formatBlurredInput: (value) => {
              if (!value) return '';
              if (!isOutputTable && !marginRegExValidation.test(value)) {
                return `${value}${t('theoreticalMarginPlaceholder')}`;
              }
              return value;
            },
            alignRight: true,
          })
        ),
        ...(isOutputTable && {
          component: ({ rowData }) => {
            if (!rowData.theoreticalMargin) return null;
            const [digits, unit] = rowData.theoreticalMargin.split(NO_BREAK_SPACE);
            return (
              <span className="dsg-input dsg-input-align-right self-center text-nowrap">
                {digits}
                {NO_BREAK_SPACE}
                {unit === 'min/100km' ? (
                  <span className="small-unit-container">
                    <span>min/</span>
                    <br />
                    <span>100km</span>
                  </span>
                ) : (
                  unit
                )}
              </span>
            );
          },
        }),
        cellClassName: ({ rowData }) =>
          cx({
            invalidCell: !isOutputTable && !rowData.isMarginValid,
            repeatedValue: rowData.isTheoreticalMarginBoundary === false, // the class should be added on false but not undefined
          }),
        title: t('theoreticalMargin'),
        headerClassName: 'padded-header',
        ...fixedWidth(isOutputTable ? 75 : 110),
        disabled: ({ rowIndex }) => isOutputTable || rowIndex === allWaypoints.length - 1,
      },
      ...extraOutputColumns,
    ] as Column<T>[];
  }, [tableType, t, allWaypoints.length, dateTimeLocale]);

  return columns;
};

export default timeColumn;
