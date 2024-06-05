import React, { useState, useEffect } from 'react';

import { DynamicDataSheetGrid } from 'react-datasheet-grid';
import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { useOsrdConfActions } from 'common/osrdContext';
import { isVia } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { removeElementAtIndex } from 'utils/array';
import { marginRegExValidation } from 'utils/physics';

import { useInputColumns } from './TimeStopsColumns';
import type { PathWaypointColumn } from './types';
import { formatSuggestedViasToRowVias } from './utils';

const WITH_KP = true;

type TimesStopsProps = {
  pathProperties: ManageTrainSchedulePathProperties | undefined;
  pathSteps?: PathStep[];
  startTime?: string;
};

type DeleteButtonProps = {
  removeVia: () => void;
  rowIndex: number;
  rowData: PathWaypointColumn;
  pathProperties: ManageTrainSchedulePathProperties;
  pathSteps: PathStep[];
};

const createDeleteViaButton = ({
  removeVia,
  rowIndex,
  rowData,
  pathProperties,
  pathSteps,
}: DeleteButtonProps) => {
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

  const columns = useInputColumns(pathProperties);

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

    dispatch(updatePathSteps({ pathSteps: updatedPathSteps }));
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
