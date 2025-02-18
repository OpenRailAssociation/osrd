import { useMemo } from 'react';

import { DatePicker, Select, TimePicker, TolerancePicker } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { updateStdcmPathStep } from 'reducers/osrdconf/stdcmConf';
import { getSearchDatetimeWindow } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { formatDateString } from 'utils/date';
import { createStringSelectOptions } from 'utils/uiCoreHelpers';

import type { ArrivalTimeTypes, ScheduleConstraint } from '../../types';

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
      minusTolerance: pathStep.tolerances.before,
      plusTolerance: pathStep.tolerances.after,
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
        startDate: formatDateString(searchDatetimeWindow.begin),
        endDate: formatDateString(searchDatetimeWindow.end),
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
          onChange={(e) => {
            if (e) {
              onArrivalTypeChange(e as ArrivalTimeTypes);
            }
          }}
          {...createStringSelectOptions(
            isOrigin
              ? ['preciseTime', 'respectDestinationSchedule']
              : ['preciseTime', 'asSoonAsPossible']
          )}
          getOptionLabel={(option) => t(`trainPath.${option}`)}
          disabled={disabled}
        />
      </div>
      {pathStep.arrivalType === 'preciseTime' && (
        <div className="schedule">
          <DatePicker
            inputProps={{
              id: `date-${opId}`,
              label: t('trainPath.date'),
              name: 'op-date',
              disabled,
            }}
            selectableSlot={selectableSlot}
            value={pathStep.arrival}
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
              onArrivalChange({
                date: pathStep.arrival || searchDatetimeWindow.begin,
                hours,
                minutes,
              });
            }}
            disabled={disabled}
            readOnly={false}
          />
          <div className="mr-n2 pr-1">
            <TolerancePicker
              id={`stdcm-tolerance-${opId}`}
              label={t('trainPath.tolerance')}
              toleranceValues={tolerances}
              onChange={() => {}}
              onToleranceChange={({ minusTolerance, plusTolerance }) => {
                dispatch(
                  updateStdcmPathStep({
                    id: pathStep.id,
                    updates: { tolerances: { before: minusTolerance, after: plusTolerance } },
                  })
                );
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
