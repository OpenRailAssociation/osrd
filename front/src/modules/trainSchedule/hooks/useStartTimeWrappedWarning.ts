import { useCallback } from 'react';

import { useTranslation } from 'react-i18next';

import { setWarning } from 'reducers/main';
import { useAppDispatch } from 'store';

/**
 * Return a callback displaying a warning when the start time of a paced train of an hourly
 * timetable was brought back into `[0, interval)` with a modulo.
 */
const useStartTimeWrappedWarning = () => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTrainSchedule.hourlyTimetableWarnings',
  });
  const dispatch = useAppDispatch();

  return useCallback(() => {
    dispatch(setWarning({ title: t('title'), text: t('startTimeWrapped') }));
  }, [dispatch, t]);
};

export default useStartTimeWrappedWarning;
