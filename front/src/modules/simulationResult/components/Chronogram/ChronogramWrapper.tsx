import { Chronogram } from '@osrd-project/ui-charts';

import type { TimetableItemWithDetails } from 'modules/timetableItem/types';

import useLevelCrossingsWithChronogram from './useLevelCrossingsWithChronogram';

const CHRONOGRAM_FOOTER_HEIGHT = 39;

type ChronogramWrapperProps = {
  timetableItemsWithDetails: TimetableItemWithDetails[];
  chronogramHeight: number;
};

const ChronogramWrapper = ({
  timetableItemsWithDetails,
  chronogramHeight,
}: ChronogramWrapperProps) => {
  const { levelCrossingData, timeOrigin } = useLevelCrossingsWithChronogram({
    trains: timetableItemsWithDetails,
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
