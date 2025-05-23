import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { isPacedTrainResponseWithPacedTrainId } from 'utils/trainId';

const formatBaseTimetableItemWithDetails = (
  timetableItem: TimetableItem,
  rollingStocks: LightRollingStockWithLiveries[]
): TimetableItemWithDetails => {
  let baseProps;
  if (isPacedTrainResponseWithPacedTrainId(timetableItem)) {
    baseProps = {
      ...timetableItem,
      paced: {
        timeWindow: Duration.parse(timetableItem.paced.time_window),
        interval: Duration.parse(timetableItem.paced.interval),
      },
    };
  } else {
    baseProps = timetableItem;
  }

  return {
    ...baseProps,
    name: timetableItem.train_name,
    startTime: new Date(timetableItem.start_time),
    stopsCount:
      (timetableItem.schedule?.filter(
        (step) => step.stop_for && Duration.parse(step.stop_for).ms > 0
      ).length ?? 0) + 1, // +1 to take the final stop (destination) into account
    speedLimitTag: timetableItem.speed_limit_tag ?? null,
    labels: timetableItem.labels ?? [],
    rollingStock: rollingStocks.find((rs) => rs.name === timetableItem.rolling_stock_name),
    isValid: false,
    arrivalTime: null,
    duration: null,
    pathLength: '',
    mechanicalEnergyConsumed: 0,
  };
};

export default formatBaseTimetableItemWithDetails;
