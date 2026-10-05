import { useCallback } from 'react';

import { useTranslation } from 'react-i18next';

import { setWarning } from 'reducers/main';
import { useAppDispatch } from 'store';

/**
 * Return a callback displaying a warning when, in an hourly timetable, the start time of a paced
 * train was brought back into `[0, interval)`, or the one of an occurrence into
 * `[0, time_window)`, with a modulo.
 */
const useStartTimeWrappedWarning = () => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.hourlyTimetableWarnings',
  });
  const dispatch = useAppDispatch();

  return useCallback(
    (isOccurrence = false) => {
      dispatch(
        setWarning({
          title: t('title'),
          text: t(isOccurrence ? 'occurrenceStartTimeWrapped' : 'startTimeWrapped'),
        })
      );
    },
    [dispatch, t]
  );
};

export default useStartTimeWrappedWarning;
