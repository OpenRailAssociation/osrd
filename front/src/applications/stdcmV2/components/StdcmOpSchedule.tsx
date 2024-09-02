import { useMemo } from 'react';

import { DatePicker, Select, TimePicker, TolerancePicker } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useOsrdConfSelectors } from 'common/osrdContext';
import { isArrivalDateInSearchTimeWindow } from 'utils/date';

import type { ArrivalTimeTypes, ScheduleConstraint } from '../types';

type StdcmOpScheduleProps = {
  disabled: boolean;
  onArrivalChange: ({ date, hours, minutes }: ScheduleConstraint) => void;
  onArrivalTypeChange: (arrivalType: ArrivalTimeTypes) => void;
  onArrivalToleranceChange: ({
    toleranceBefore,
    toleranceAfter,
  }: {
    toleranceBefore: number;
    toleranceAfter: number;
  }) => void;
  opScheduleTimeType: ArrivalTimeTypes;
  opTimingData?: {
    arrivalDate: string;
    arrivalTime: string;
    arrivalTimehours: number;
    arrivalTimeMinutes: number;
  };
  opToleranceValues: {
    arrivalToleranceBefore: number;
    arrivalToleranceAfter: number;
  };
  opId: string;
};

const defaultDate = (date?: Date) => {
  const newDate = date ? new Date(date) : new Date();
  newDate.setHours(0);
  newDate.setMinutes(0);
  newDate.setSeconds(0);
  return newDate;
};

const StdcmOpSchedule = ({
  disabled,
  onArrivalChange,
  onArrivalTypeChange,
  onArrivalToleranceChange,
  opTimingData,
  opScheduleTimeType,
  opToleranceValues,
  opId,
}: StdcmOpScheduleProps) => {
  const { t } = useTranslation('stdcm');
  const { getSearchDatetimeWindow } = useOsrdConfSelectors();
  const searchDatetimeWindow = useSelector(getSearchDatetimeWindow);

  const { arrivalDate, arrivalTime, arrivalTimeHours, arrivalTimeMinutes, arrivalToleranceValues } =
    useMemo(() => {
      const isArrivalDateValid =
        opTimingData?.arrivalDate &&
        isArrivalDateInSearchTimeWindow(opTimingData.arrivalDate, searchDatetimeWindow);
      return {
        arrivalDate:
          opTimingData && isArrivalDateValid
            ? new Date(opTimingData.arrivalDate)
            : defaultDate(searchDatetimeWindow?.begin),
        arrivalTime: opTimingData?.arrivalTime || '--:--',
        arrivalTimeHours: opTimingData?.arrivalTimehours,
        arrivalTimeMinutes: opTimingData?.arrivalTimeMinutes,
        arrivalToleranceValues: {
          minusTolerance: opToleranceValues.arrivalToleranceBefore,
          plusTolerance: opToleranceValues.arrivalToleranceAfter,
        },
      };
    }, [opTimingData, opToleranceValues, searchDatetimeWindow]);

  return (
    <div className="d-flex flex-column">
      <div className="col-12 pr-1">
        <Select
          id={`select-${opId}`}
          value={opScheduleTimeType}
          onChange={(e) => {
            if (e) {
              onArrivalTypeChange(e as ArrivalTimeTypes);
            }
          }}
          options={['preciseTime', 'asSoonAsPossible']}
          getOptionLabel={(option) => t(`trainPath.${option}`)}
          getOptionValue={(option) => option}
          disabled={disabled}
        />
      </div>
      {opScheduleTimeType === 'preciseTime' && (
        <div className="d-flex">
          <div className="col-5 pr-0">
            {/* TODO: Remove empty onChange events once we fix the warning on ui-core side */}
            <DatePicker
              inputProps={{
                id: `date-${opId}`,
                label: t('trainPath.date'),
                name: 'op-date',
                disabled,
                onChange: () => {},
              }}
              value={arrivalDate}
              calendarPickerProps={
                searchDatetimeWindow
                  ? {
                      selectableSlot: {
                        start: searchDatetimeWindow.begin,
                        end: searchDatetimeWindow.end,
                      },
                    }
                  : undefined
              }
              onDateChange={(e) => {
                onArrivalChange({
                  date: e,
                  hours: arrivalTimeHours || 0,
                  minutes: arrivalTimeMinutes || 0,
                });
              }}
            />
          </div>
          <div className="col-3 ml-1 px-0">
            <TimePicker
              id={`time-${opId}`}
              label={t('trainPath.time')}
              hours={arrivalTimeHours}
              minutes={arrivalTimeMinutes}
              onTimeChange={({ hours, minutes }) => {
                onArrivalChange({ date: arrivalDate, hours, minutes });
              }}
              disabled={disabled}
              value={arrivalTime}
              readOnly={false}
            />
          </div>
          <div className="col-4 ml-1 pl-0 pr-1">
            <TolerancePicker
              id={`stdcm-tolerance-${opId}`}
              label={t('trainPath.tolerance')}
              toleranceValues={arrivalToleranceValues}
              onChange={() => {}}
              onToleranceChange={({ minusTolerance, plusTolerance }) => {
                onArrivalToleranceChange({
                  toleranceBefore: minusTolerance,
                  toleranceAfter: plusTolerance,
                });
              }}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StdcmOpSchedule;
