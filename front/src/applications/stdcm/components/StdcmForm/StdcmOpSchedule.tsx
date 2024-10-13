import { useMemo } from 'react';

import { DatePicker, Select, TimePicker, TolerancePicker } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useOsrdConfSelectors } from 'common/osrdContext';
import { formatDateString, isArrivalDateInSearchTimeWindow } from 'utils/date';
import { createStringSelectOptions } from 'utils/uiCoreHelpers';

import type { ArrivalTimeTypes, ScheduleConstraint } from '../../types';

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

  const selectableSlot = useMemo(
    () =>
      searchDatetimeWindow
        ? {
            start: searchDatetimeWindow.begin,
            end: searchDatetimeWindow.end,
          }
        : undefined,
    [searchDatetimeWindow]
  );

  const datePickerErrorMessages = useMemo(
    () => ({
      invalidInput: t('form.datePickerErrors.invalidInput'),
      invalidDate: t('form.datePickerErrors.invalidDate', {
        startDate: formatDateString(searchDatetimeWindow?.begin),
        endDate: formatDateString(searchDatetimeWindow?.end),
      }),
    }),
    [t, searchDatetimeWindow]
  );

  return (
    <>
      <div className="arrival-type-select">
        <Select
          id={`select-${opId}`}
          value={opScheduleTimeType}
          onChange={(e) => {
            if (e) {
              onArrivalTypeChange(e as ArrivalTimeTypes);
            }
          }}
          {...createStringSelectOptions(['preciseTime', 'asSoonAsPossible'])}
          getOptionLabel={(option) => t(`trainPath.${option}`)}
          disabled={disabled}
        />
      </div>
      {opScheduleTimeType === 'preciseTime' && (
        <div className="schedule">
          {/* TODO: Remove empty onChange events once we fix the warning on ui-core side */}
          <DatePicker
            inputProps={{
              id: `date-${opId}`,
              label: t('trainPath.date'),
              name: 'op-date',
              disabled,
              onChange: () => {},
            }}
            selectableSlot={selectableSlot}
            value={arrivalDate}
            onDateChange={(e) => {
              onArrivalChange({
                date: e,
                hours: arrivalTimeHours || 0,
                minutes: arrivalTimeMinutes || 0,
              });
            }}
            errorMessages={datePickerErrorMessages}
          />
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
          <div className="mr-n2 pr-1">
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
    </>
  );
};

export default StdcmOpSchedule;
