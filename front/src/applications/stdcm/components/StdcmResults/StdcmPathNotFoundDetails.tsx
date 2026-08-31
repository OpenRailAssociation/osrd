import { uniqBy } from 'lodash';
import { Trans, useTranslation } from 'react-i18next';

import type { StdcmPathNotFoundOutput } from 'applications/stdcm/types';
import { timeToLocaleStringRounded, useDateTimeLocale } from 'utils/date';

type StdcmPathNotFoundDetailsProps = {
  outputs: StdcmPathNotFoundOutput;
  showAlternativeSimulationsInfo: boolean;
};

/** Explains why no path was found, so the user can reformulate their request. */
const StdcmPathNotFoundDetails = ({
  outputs,
  showAlternativeSimulationsInfo,
}: StdcmPathNotFoundDetailsProps) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });
  const dateTimeLocale = useDateTimeLocale();

  const formatTime = (isoDate: string) =>
    timeToLocaleStringRounded(new Date(isoDate), dateTimeLocale);

  const lastReachedOperationalPoint = outputs.last_reached_operational_point;
  // The work schedules delaying the train the most, then the one nearest to the destination.
  // The same work can be planned on several days, only display it once.
  const workSchedules = uniqBy(
    [...outputs.most_blocking_work_schedules, ...outputs.nearest_to_destination_work_schedules],
    'obj_id'
  );

  return (
    <div className="simulation-failure" data-testid="stdcm-path-not-found-details">
      <span className="title">{t('notFound')}</span>

      {lastReachedOperationalPoint && (
        <span className="nearest-reached-point" data-testid="stdcm-nearest-reached-point">
          <Trans components={{ strong: <strong /> }}>
            {t('nearestReachedPoint', {
              name: lastReachedOperationalPoint.operational_point.name,
              time: formatTime(lastReachedOperationalPoint.arrival_time),
            })}
          </Trans>
        </span>
      )}

      {workSchedules.length > 0 ? (
        <div className="blocking-work-schedules" data-testid="stdcm-blocking-work-schedules">
          <span className="conflicts-title">{t('mainConflicts')}</span>
          <ul>
            {workSchedules.map(({ id, start_date_time, end_date_time }) => (
              <li key={id}>
                <span>
                  &bull;&nbsp;
                  {t('blockingWorkSchedule', {
                    startTime: formatTime(start_date_time),
                    endTime: formatTime(end_date_time),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <span className="too-much-traffic" data-testid="stdcm-too-much-traffic">
          {t('tooMuchTraffic')}
        </span>
      )}

      <span className="change-criteria">{t('changeSearchCriteria')}</span>

      {showAlternativeSimulationsInfo && (
        <div className="alternative-simulations-info">{t('simulationsWithConflicts')}</div>
      )}
    </div>
  );
};

export default StdcmPathNotFoundDetails;
