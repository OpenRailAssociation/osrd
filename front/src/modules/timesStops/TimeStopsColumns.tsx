import { useMemo } from 'react';

import cx from 'classnames';
import { keyColumn, type Column, checkboxColumn, createTextColumn } from 'react-datasheet-grid';
import type { CellComponent } from 'react-datasheet-grid/dist/types';
import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { marginRegExValidation } from 'utils/physics';

import TimeInput from './TimeInput';
import type { PathWaypointColumn } from './types';

const timeColumn: Partial<Column<string | null | undefined, string, string>> = {
  component: TimeInput as CellComponent<string | null | undefined, string>,
  deleteValue: () => null,
  copyValue: ({ rowData }) => rowData ?? null,
  pasteValue: ({ value }) => value,
  minWidth: 170,
  isCellEmpty: ({ rowData }) => !rowData,
};

export const useInputColumns = (pathProperties: ManageTrainSchedulePathProperties) => {
  const { t } = useTranslation('timesStops');
  const columns = useMemo<Column<PathWaypointColumn>[]>(
    () => [
      {
        ...keyColumn('name', createTextColumn()),
        title: t('name'),
        disabled: true,
      },
      {
        ...keyColumn('ch', createTextColumn()),
        title: 'Ch',
        disabled: true,
        grow: 0.1,
      },
      {
        ...keyColumn('arrival', timeColumn),
        title: t('arrivalTime'),

        // We should not be able to edit the arrival time of the origin
        disabled: ({ rowIndex }) => rowIndex === 0,
        grow: 0.6,
      },
      {
        ...keyColumn(
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
        ...keyColumn('onStopSignal', checkboxColumn as Partial<Column<boolean | undefined>>),
        title: t('receptionOnClosedSignal'),

        // We should not be able to edit the reception on close signal if stopFor is not filled
        // except for the destination
        grow: 0.6,
        disabled: ({ rowData, rowIndex }) =>
          rowIndex !== pathProperties.allWaypoints?.length - 1 && !rowData.stopFor,
      },
      {
        ...keyColumn(
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
        cellClassName: ({ rowData }) => cx({ invalidCell: !rowData.isMarginValid }),
        title: t('theoreticalMargin'),
        disabled: ({ rowIndex }) => rowIndex === pathProperties.allWaypoints.length - 1,
      },
    ],
    [t, pathProperties.allWaypoints.length]
  );
  return columns;
};

export default timeColumn;
