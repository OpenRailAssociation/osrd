/* eslint-disable @typescript-eslint/no-shadow */
import React, { useMemo } from 'react';

import { DatePicker, Select, TimePicker, TolerancePicker } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useOsrdConfSelectors } from 'common/osrdContext';
import { formatLocaleDateToIsoDate, isArrivalDateInSearchTimeWindow } from 'utils/date';

import type { ArrivalTimeTypes } from '../types';

type StdcmOpScheduleProps = {
  disabled: boolean;
  onArrivalChange: (arrival: string) => void;
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

  const updateOpArrival = (date: Date, { hours, minutes }: { hours: number; minutes: number }) => {
    date.setHours(hours);
    date.setMinutes(minutes);
    const newOpArrival = formatLocaleDateToIsoDate(date);
    onArrivalChange(newOpArrival);
  };

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
            <DatePicker
              inputProps={{
                id: `date-${opId}`,
                label: t('trainPath.date'),
                name: 'op-date',
                disabled,
              }}
              value={arrivalDate}
              calendarPickerProps={{
                selectableSlot: searchDatetimeWindow
                  ? {
                      start: searchDatetimeWindow.begin,
                      end: searchDatetimeWindow.end,
                    }
                  : undefined,
              }}
              onDateChange={(e) => {
                updateOpArrival(e, {
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
                updateOpArrival(arrivalDate, {
                  hours,
                  minutes,
                });
              }}
              disabled={disabled}
              value={arrivalTime}
            />
          </div>
          <div className="col-4 ml-1 pl-0 pr-1">
            <TolerancePicker
              id={`stdcm-tolerance-${opId}`}
              label={t('trainPath.tolerance')}
              toleranceValues={arrivalToleranceValues}
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
