import { useContext, useMemo, useEffect } from 'react';

import { SpaceTimeChartContext } from '@osrd-project/ui-charts';

const TimeRangeObserver = ({
  onChange,
}: {
  onChange: (range: { start: number; end: number }) => void;
}) => {
  const { width, height, getData } = useContext(SpaceTimeChartContext);

  const timeRange = useMemo(() => {
    const minPoint = getData({ x: 0, y: 0 });
    const maxPoint = getData({ x: width, y: height });
    return { start: minPoint.time, end: maxPoint.time };
  }, [width, height, getData]);

  useEffect(() => onChange(timeRange), [timeRange]);

  return null;
};

export default TimeRangeObserver;
