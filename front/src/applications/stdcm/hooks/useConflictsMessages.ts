import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { formatConflicts } from 'applications/stdcm/utils/formatConflicts';
import { hasConflicts } from 'applications/stdcm/utils/simulationOutputUtils';

import type { StdcmSimulationOutputs } from '../types';

const useConflictsMessages = (selectedSimulationOutput?: StdcmSimulationOutputs) => {
  const { t } = useTranslation('stdcm', { keyPrefix: 'simulation.results' });
  const [trackConflicts, setTrackConflicts] = useState<string[]>([]);
  const [workConflicts, setWorkConflicts] = useState<string[]>([]);

  useEffect(() => {
    if (!hasConflicts(selectedSimulationOutput)) return;

    const generateConflictMessages = () => {
      const { pathProperties } = selectedSimulationOutput;
      const { trackConflictsData, workConflictsData } = formatConflicts(
        selectedSimulationOutput?.conflicts,
        pathProperties
      );

      const trackMessages: string[] = [];
      trackConflictsData.slice(0, 2).forEach((conflict) => {
        const { waypointBefore, waypointAfter, startDate, endDate, startTime, endTime } = conflict;

        if (startDate === endDate) {
          trackMessages.push(
            t('trackConflictSameDay', {
              waypointBefore,
              waypointAfter,
              startTime,
              endTime,
              startDate,
            })
          );
        } else {
          trackMessages.push(
            t('trackConflict', {
              waypointBefore,
              waypointAfter,
              startDate,
              endDate,
              startTime,
              endTime,
            })
          );
        }
      });

      const remainingTrackConflicts = trackConflictsData.length - 2;
      if (remainingTrackConflicts > 0) {
        trackMessages.push(t('remainingTrackConflicts', { count: remainingTrackConflicts }));
      }

      const workMessages: string[] = [];
      workConflictsData.slice(0, 2).forEach((conflict) => {
        const { waypointBefore, waypointAfter, startDate, endDate, startTime, endTime } = conflict;

        if (startDate === endDate) {
          workMessages.push(
            t('workConflictSameDay', {
              waypointBefore,
              waypointAfter,
              startDate,
              startTime,
              endTime,
            })
          );
        } else {
          workMessages.push(
            t('workConflict', {
              waypointBefore,
              waypointAfter,
              startDate,
              startTime,
              endDate,
              endTime,
            })
          );
        }
      });

      const remainingWorkConflicts = workConflictsData.length - 2;
      if (remainingWorkConflicts > 0) {
        workMessages.push(t('remainingWorkConflicts', { count: remainingWorkConflicts }));
      }

      // Update the state with generated messages
      setTrackConflicts(trackMessages);
      setWorkConflicts(workMessages);
    };

    generateConflictMessages();
  }, [t, selectedSimulationOutput]);

  return { trackConflicts, workConflicts };
};

export default useConflictsMessages;
