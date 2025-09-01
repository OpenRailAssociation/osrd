import { useMemo } from 'react';

import { DatePicker, Select, TimePicker, TolerancePicker } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { updateStdcmPathStep } from 'reducers/osrdconf/stdcmConf';
import { getSearchDatetimeWindow } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';
import { createStandardSelectOptions } from 'utils/uiCoreHelpers';

import { ArrivalTimeTypes, type ScheduleConstraint } from '../../types';

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: '2-digit' });

type StdcmOpScheduleProps = {
  disabled: boolean;
  pathStep: Extract<StdcmPathStep, { isVia: false }>;
  opId: string;
  isOrigin?: boolean;
};

const StdcmOpSchedule = ({ disabled, pathStep, opId, isOrigin = false }: StdcmOpScheduleProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();

  const searchDatetimeWindow = useSelector(getSearchDatetimeWindow);

  const { arrivalTimeHours, arrivalTimeMinutes } = useMemo(() => {
    if (!pathStep.arrival) {
      return {
        arrivalTimeHours: undefined,
        arrivalTimeMinutes: undefined,
      };
    }
    return {
      arrivalTimeHours: pathStep.arrival.getHours(),
      arrivalTimeMinutes: pathStep.arrival.getMinutes(),
    };
  }, [pathStep.arrival]);

  const tolerances = useMemo(
    () => ({
      minusTolerance: pathStep.tolerances.before.total('second'),
      plusTolerance: pathStep.tolerances.after.total('second'),
    }),
    [pathStep.tolerances]
  );

  const selectableSlot = useMemo(
    () => ({
      start: searchDatetimeWindow.begin,
      end: searchDatetimeWindow.end,
    }),
    [searchDatetimeWindow]
  );

  const datePickerErrorMessages = useMemo(
    () => ({
      invalidInput: t('form.datePickerErrors.invalidInput'),
      invalidDate: t('form.datePickerErrors.invalidDate', {
        startDate: formatDate(searchDatetimeWindow.begin),
        endDate: formatDate(searchDatetimeWindow.end),
      }),
    }),
    [t, searchDatetimeWindow]
  );

  const onArrivalChange = ({ date, hours, minutes }: ScheduleConstraint) => {
    // We need to create a new date object to avoid mutating the original one
    // otherwise the useEffect/useMemo will not be triggered
    const newDate = new Date(date);
    newDate.setHours(hours, minutes);
    dispatch(
      updateStdcmPathStep({
        id: pathStep.id,
        updates: { arrival: newDate },
      })
    );
  };

  const onArrivalTypeChange = (arrivalType: ArrivalTimeTypes) => {
    dispatch(updateStdcmPathStep({ id: pathStep.id, updates: { arrivalType } }));
  };

  return (
    <>
      <div className="arrival-type-select">
        <Select
          id={`select-${opId}`}
          value={pathStep.arrivalType}
          onChange={(e?: ArrivalTimeTypes) => {
            if (e) {
              onArrivalTypeChange(e);
            }
          }}
          {...createStandardSelectOptions<ArrivalTimeTypes>(
            isOrigin
              ? [ArrivalTimeTypes.PRECISE_TIME, ArrivalTimeTypes.RESPECT_DESTINATION_SCHEDULE]
              : [ArrivalTimeTypes.PRECISE_TIME, ArrivalTimeTypes.ASAP]
          )}
          getOptionLabel={(option) => t(`trainPath.${option}`)}
          disabled={disabled}
          narrow
        />
      </div>
      {pathStep.arrivalType === 'preciseTime' && (
        <div className="schedule">
          <DatePicker
            testIdPrefix={`date-${opId}`}
            inputProps={{
              id: `date-${opId}`,
              label: t('trainPath.date'),
              name: 'op-date',
              disabled,
              narrow: true,
            }}
            selectableSlot={selectableSlot}
            value={pathStep.arrival}
            onDateChange={(e) => {
              if (!e) return;
              onArrivalChange({
                date: e,
                hours: arrivalTimeHours || 0,
                minutes: arrivalTimeMinutes || 0,
              });
            }}
            errorMessages={datePickerErrorMessages}
          />
          <TimePicker
            testIdPrefix={`time-${opId}`}
            id={`time-${opId}`}
            label={t('trainPath.time')}
            hours={arrivalTimeHours}
            minutes={arrivalTimeMinutes}
            onTimeChange={({ hours, minutes }) => {
              onArrivalChange({
                date: pathStep.arrival || searchDatetimeWindow.begin,
                hours,
                minutes,
              });
            }}
            disabled={disabled}
            readOnly={false}
            narrow
          />
          <TolerancePicker
            testIdPrefix={`tolerance-${opId}`}
            id={`stdcm-tolerance-${opId}`}
            label={t('trainPath.tolerance')}
            toleranceValues={tolerances}
            onChange={() => {}}
            onToleranceChange={({ minusTolerance, plusTolerance }) => {
              dispatch(
                updateStdcmPathStep({
                  id: pathStep.id,
                  updates: {
                    tolerances: {
                      before: new Duration({ seconds: minusTolerance }),
                      after: new Duration({ seconds: plusTolerance }),
                    },
                  },
                })
              );
            }}
            disabled={disabled}
            narrow
          />
        </div>
      )}
    </>
  );
};

export default StdcmOpSchedule;
