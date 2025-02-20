import { Dot } from '@osrd-project/ui-icons';
import dayjs from 'dayjs';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';

const formatDateHours = (d: Date) => dayjs(d).format('HH:mm');
export type Occurrence = {
  id: string;
  trainName: string;
  rollingStock?: LightRollingStockWithLiveries;
  startTime: Date;
  arrivalTime: Date;
};
type OccurrenceItemProps = { occurrence: Occurrence };
const OccurrenceItem = ({ occurrence }: OccurrenceItemProps) => {
  const { id, trainName, rollingStock, startTime, arrivalTime } = occurrence;

  return (
    <div className="occurrence-item">
      <div className="occurrence-item-dot">
        <Dot variant="fill" />
      </div>
      <div className="occurrence-item-label">{trainName}</div>
      <div className="rolling-stock">
        {rollingStock && (
          <div className="rolling-stock-img">
            <RollingStock2Img rollingStock={rollingStock} />
          </div>
        )}
      </div>
      <div className="occurrence-item-times">
        <div className="occurrence-item-time">{formatDateHours(startTime)}</div>
        <div className="occurrence-item-time arrival-time">{formatDateHours(arrivalTime)}</div>
      </div>
    </div>
  );
};

export default OccurrenceItem;
