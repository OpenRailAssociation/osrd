import { Chronogram } from '@osrd-project/ui-charts';

import type { TrainScheduleWithDetails } from 'modules/timetableItem/types';

import useLevelCrossingsWithChronogram from './useLevelCrossingsWithChronogram';

const CHRONOGRAM_FOOTER_HEIGHT = 39;

type ChronogramWrapperProps = {
  timetableId: number;
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  chronogramHeight: number;
};

const ChronogramWrapper = ({
  timetableId,
  trainSchedulesWithDetails,
  chronogramHeight,
}: ChronogramWrapperProps) => {
  const { levelCrossingData, timeOrigin } = useLevelCrossingsWithChronogram(timetableId, {
    trains: trainSchedulesWithDetails,
  });

  return (
    levelCrossingData && (
      <Chronogram
        timeOrigin={timeOrigin}
        levelCrossingData={levelCrossingData}
        height={chronogramHeight - CHRONOGRAM_FOOTER_HEIGHT}
      />
    )
  );
};

export default ChronogramWrapper;
