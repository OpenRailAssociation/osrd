import { useEffect, useMemo, useState } from 'react';

import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  PathfindingResultSuccess,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import { interpolateValue } from 'modules/simulationResult/SimulationResultExport/utils';
import type { SimulationSummary } from 'modules/timetableItem/components/Timetable/types';
import type { Train } from 'reducers/osrdconf/types';
import { dateToHHMMSS } from 'utils/date';
import { Duration } from 'utils/duration';

import { ARRIVAL_TIME_ACCEPTABLE_ERROR } from '../consts';
import { computeInputDatetimes } from '../helpers/arrivalTime';
import computeMargins, { getTheoreticalMargins } from '../helpers/computeMargins';
import { formatSchedule } from '../helpers/scheduleData';
import { type ScheduleEntry, type TimesStopsRow } from '../types';

const useOutputTableData = (
  simulatedTrain?: SimulationResponseSuccess['final_output'],
  simulationSummary?: SimulationSummary,
  operationalPoints?: PathPropertiesFormatted['operationalPoints'],
  selectedTrain?: Train,
  path?: PathfindingResultSuccess
): TimesStopsRow[] => {
  const { t } = useTranslation();
  const { getTrackSectionsByIds } = useScenarioContext();

  const [rows, setRows] = useState<TimesStopsRow[]>([]);

  const scheduleByAt: Record<string, ScheduleEntry> = keyBy(selectedTrain?.schedule, 'at');
  const theoreticalMargins = selectedTrain && getTheoreticalMargins(selectedTrain);

  const pathStepRowsById: Map<string, Partial<TimesStopsRow>> = useMemo(() => {
    if (!selectedTrain || !simulationSummary?.isValid || !path) return new Map();

    const { pathItemTimes } = simulationSummary;

    const startDatetime = new Date(selectedTrain.start_time);
    let lastReferenceDate = startDatetime;

    return new Map(
      selectedTrain.path.map((pathStep, index) => {
        const schedule: ScheduleEntry | undefined = scheduleByAt[pathStep.id];

        const computedArrival = new Date(startDatetime.getTime() + pathItemTimes.final[index]);

        const { stopFor, shortSlipDistance, onStopSignal, calculatedDeparture } = formatSchedule(
          computedArrival,
          schedule
        );
        const {
          theoreticalMargin,
          isTheoreticalMarginBoundary,
          theoreticalMarginSeconds,
          calculatedMargin,
          diffMargins,
        } = computeMargins(theoreticalMargins, selectedTrain, scheduleByAt, index, pathItemTimes);

        const { theoreticalArrival, arrival, departure, refDate } = computeInputDatetimes(
          startDatetime,
          lastReferenceDate,
          schedule,
          {
            isDeparture: index === 0,
          }
        );
        lastReferenceDate = refDate;

        const isOnTime = theoreticalArrival
          ? Duration.subtractDate(theoreticalArrival, computedArrival).abs() <=
            ARRIVAL_TIME_ACCEPTABLE_ERROR
          : false;

        const pathStepRow = {
          pathStepId: pathStep.id,
          name: t('timeStopTable.waypoint', { id: pathStep.id }),
          ch: undefined,

          arrival,
          departure,
          stopFor,
          onStopSignal,
          shortSlipDistance,
          theoreticalMargin,
          isTheoreticalMarginBoundary,

          theoreticalMarginSeconds,
          calculatedMargin,
          diffMargins,
          calculatedArrival: dateToHHMMSS(isOnTime ? theoreticalArrival! : computedArrival),
          calculatedDeparture,
        };

        return [pathStepRow.pathStepId, pathStepRow];
      })
    );
  }, [selectedTrain, path, simulationSummary]);

  useEffect(() => {
    const formatRows = async () => {
      if (!operationalPoints || !selectedTrain || !simulatedTrain) {
        setRows([]);
        return;
      }

      const trackIds = operationalPoints.map((op) => op.part.track);
      const trackSections = await getTrackSectionsByIds(trackIds);

      const formattedRows = operationalPoints.map((op) => {
        const matchingPathStep = selectedTrain?.path.find((pathStep) =>
          matchPathStepAndOp(pathStep, {
            opId: op.id,
            uic: op.extensions?.identifier?.uic,
            ch: op.extensions?.sncf?.ch,
            trigram: op.extensions?.sncf?.trigram,
            track: op.part.track,
            offsetOnTrack: op.part.position,
          })
        );

        const matchingPathStepRow = matchingPathStep
          ? pathStepRowsById.get(matchingPathStep.id)
          : undefined;

        if (matchingPathStepRow) {
          return {
            ...matchingPathStepRow,
            opId: op.id,
            name: op.extensions?.identifier?.name,
            ch: op.extensions?.sncf?.ch,
            trackName: trackSections[op.part.track]?.extensions?.sncf?.track_name,
          };
        }

        // compute arrival time
        const matchingReportTrainIndex = simulatedTrain.positions.findIndex(
          (position) => position === op.position
        );

        const time =
          matchingReportTrainIndex === -1
            ? interpolateValue(simulatedTrain, op.position, 'times')
            : simulatedTrain.times[matchingReportTrainIndex];
        const calculatedArrival = new Date(new Date(selectedTrain.start_time).getTime() + time);

        return {
          opId: op.id,
          name: op.extensions?.identifier?.name,
          ch: op.extensions?.sncf?.ch,
          calculatedArrival: dateToHHMMSS(calculatedArrival),
          trackName: trackSections[op.part.track]?.extensions?.sncf?.track_name,
        };
      });
      setRows(formattedRows);
    };

    formatRows();
  }, [operationalPoints, pathStepRowsById, simulatedTrain, getTrackSectionsByIds]);

  return rows;
};

export default useOutputTableData;
